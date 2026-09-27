#!/usr/bin/env bash
# Discord two-way proof.
#   scripts/discord-proof.sh --offline     mocked HMAC path (CI-safe, default if no live env)
#   scripts/discord-proof.sh --contract    supplementary live-HTTP contract against AIMS_BASE_URL
#   scripts/discord-proof.sh               mandatory real-Gateway E2E (fails if worker/human missing)
set -euo pipefail
set +x

MODE="live"
if [[ "${1:-}" == "--offline" ]]; then MODE="offline"; fi
if [[ "${1:-}" == "--contract" ]]; then MODE="contract"; fi

if [[ "$MODE" == "offline" ]]; then
  exec "$(dirname "$0")/discord-offline-proof.sh"
fi

redact() {
  sed -E 's#https://[^[:space:]]+#https://[redacted]#g; s#(own_|inbox_|rpl_|Bot )[A-Za-z0-9._-]+#\1[redacted]#g'
}

py() {
  python3 -c "$1"
}

if [[ "$MODE" == "contract" ]]; then
  BASE="${AIMS_BASE_URL:-https://aims.bot}"
  BASE="${BASE%/}"
  echo "== CONTRACT_ONLY health @ $BASE =="
  for path in /api/v1/health /api/health /health; do
    HEALTH="$(curl -sS "$BASE$path")"
    echo "$HEALTH" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("product")=="linktree", d; assert d.get("db")=="connected", d'
  done

  echo "== create inbox =="
  INBOX="$(curl -sS -X POST "$BASE/api/v1/inbox")"
  TOKEN="$(echo "$INBOX" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success") is True, d; print(d["token"])')"
  INBOX_URL="$BASE/api/v1/inbox/$TOKEN"

  echo "== create page =="
  PAGE="$(curl -sS -X POST "$BASE/api/v1/pages" \
    -H 'Content-Type: application/json' \
    -d "$(py "import json; print(json.dumps({'name':'botlord','webhookUrl':'''$INBOX_URL'''}))" )")"
  SLUG="$(echo "$PAGE" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success") is True, d; print(d["page"]["slug"])')"
  OWNER="$(echo "$PAGE" | py 'import json,sys; print(json.load(sys.stdin)["ownerToken"])')"

  if [[ -n "${DISCORD_PROOF_GUILD_ID:-}" && -n "${DISCORD_PROOF_CHANNEL_ID:-}" ]]; then
    curl -sS -X POST "$BASE/api/v1/pages/$SLUG/discord" \
      -H "Authorization: Bearer $OWNER" \
      -H 'Content-Type: application/json' \
      -d "$(py "import json; print(json.dumps({'guildId':'''${DISCORD_PROOF_GUILD_ID}''','channelId':'''${DISCORD_PROOF_CHANNEL_ID}''','handle':'botlord'}))" )" >/dev/null
  fi

  if [[ -z "${DISCORD_WORKER_SECRET:-}" ]]; then
    echo "CONTRACT_ONLY: skip synthetic HMAC (DISCORD_WORKER_SECRET unset)"
    exit 0
  fi

  NONCE="contract$(date +%s)"
  TS="$(date +%s)"
  BODY="$(py "import json; print(json.dumps({'type':'MESSAGE_CREATE','message':{'id':'''$NONCE''','channel_id':'''${DISCORD_PROOF_CHANNEL_ID:-222}''','guild_id':'''${DISCORD_PROOF_GUILD_ID:-111}''','content':'<@${DISCORD_BOT_USER_ID:-aims-bot-id}> botlord $NONCE','author':{'id':'human-proof','username':'alex'},'mentions':[{'id':'${DISCORD_BOT_USER_ID:-aims-bot-id}'}]}}))" )"
  SIG="$(py "
import hashlib, hmac, os
body = '''$BODY'''.encode()
ts = '''$TS'''
nonce = '''$NONCE'''
secret = os.environ['DISCORD_WORKER_SECRET']
digest = hashlib.sha256(body).hexdigest()
print(hmac.new(secret.encode(), f'{ts}.{nonce}.{digest}'.encode(), hashlib.sha256).hexdigest())
")"
  curl -sS -X POST "$BASE/api/v1/discord/events" \
    -H 'Content-Type: application/json' \
    -H "X-Aims-Timestamp: $TS" \
    -H "X-Aims-Nonce: $NONCE" \
    -H "X-Aims-Signature: $SIG" \
    -d "$BODY" >/dev/null
  GOT="$(curl -sS "$INBOX_URL")"
  echo "$GOT" | py "import json,sys
d=json.load(sys.stdin)
assert d.get('count',0)>=1, d
payload=d['payloads'][-1]['payload']
assert payload['event']=='contact.message', payload
assert payload.get('discord',{}).get('handle')=='botlord', payload
assert 'reply' in payload and payload['reply'].get('url'), payload
print('CONTRACT_ONLY')"
  exit 0
fi

# Mandatory live Gateway E2E
: "${DISCORD_BOT_TOKEN:?DISCORD_BOT_TOKEN required for live E2E}"
: "${DISCORD_PROOF_CHANNEL_ID:?DISCORD_PROOF_CHANNEL_ID required for live E2E}"
: "${DISCORD_E2E_NONCE:?DISCORD_E2E_NONCE required — human types @aims botlord <nonce>}"
: "${DISCORD_WORKER_HEALTH_URL:?DISCORD_WORKER_HEALTH_URL required (Fly worker /health)}"
export DISCORD_E2E_NONCE
export DISCORD_BOT_TOKEN
export DISCORD_BOT_USER_ID="${DISCORD_BOT_USER_ID:-${DISCORD_CLIENT_ID:-}}"

WORKER_HEALTH="$(curl -sS "$DISCORD_WORKER_HEALTH_URL")"
echo "$WORKER_HEALTH" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("gateway")=="ready", d'

BASE="${AIMS_BASE_URL:-https://aims.bot}"
BASE="${BASE%/}"
INBOX_TOKEN="${DISCORD_PROOF_INBOX_TOKEN:-}"
if [[ -z "$INBOX_TOKEN" ]]; then
  echo "live E2E needs DISCORD_PROOF_INBOX_TOKEN for the bound page inbox" >&2
  exit 1
fi

deadline=$((SECONDS + 90))
found=0
while [[ $SECONDS -lt $deadline ]]; do
  GOT="$(curl -sS "$BASE/api/v1/inbox/$INBOX_TOKEN")"
  if echo "$GOT" | py "import json,sys
d=json.load(sys.stdin)
hits=[p for p in d.get('payloads',[]) if '''$DISCORD_E2E_NONCE''' in str(p)]
assert len(hits)==1
print('wake_ok')
" 2>/dev/null; then
    found=1
    break
  fi
  sleep 2
done
if [[ "$found" != "1" ]]; then
  echo "no Gateway-originated wake for DISCORD_E2E_NONCE" >&2
  exit 1
fi

MESSAGES="$(curl -sS "https://discord.com/api/v10/channels/${DISCORD_PROOF_CHANNEL_ID}/messages?limit=20" \
  -H "Authorization: Bot ${DISCORD_BOT_TOKEN}")"
echo "$MESSAGES" | py "import json,sys,os
nonce=os.environ['DISCORD_E2E_NONCE']
msgs=json.load(sys.stdin)
bot=os.environ.get('DISCORD_BOT_USER_ID') or os.environ.get('DISCORD_CLIENT_ID')
hits=[]
for m in msgs:
    content=m.get('content') or ''
    author=(m.get('author') or {}).get('id')
    ref=((m.get('message_reference') or {}).get('message_id'))
    if nonce in content and '**botlord:**' in content and (not bot or author==bot):
        hits.append(m)
assert hits, {'error':'no correlated bot reply','nonce':nonce}
print('LIVE_GATEWAY_OK')
"

echo "PASS live Discord Gateway e2e"
