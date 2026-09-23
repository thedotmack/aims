#!/usr/bin/env bash
# Prove aims.bot bot2bot: create inbox + page, POST a message, assert webhook + ack.
# Usage: scripts/bot2bot-proof.sh [https://aims.bot]
set -euo pipefail

BASE="${1:-${AIMS_BASE_URL:-https://aims.bot}}"
BASE="${BASE%/}"

py() {
  python3 -c "$1"
}

echo "== health @ $BASE =="
HEALTH="$(curl -sS "$BASE/api/v1/health")"
echo "$HEALTH"
echo "$HEALTH" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("product")=="linktree", d; assert d.get("db")=="connected", d'

echo "== create inbox =="
INBOX="$(curl -sS -X POST "$BASE/api/v1/inbox")"
echo "$INBOX"
TOKEN="$(echo "$INBOX" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success") is True, d; print(d["token"])')"
INBOX_URL="$BASE/api/v1/inbox/$TOKEN"

echo "== create page with webhook $INBOX_URL =="
PAGE="$(curl -sS -X POST "$BASE/api/v1/pages" \
  -H 'Content-Type: application/json' \
  -d "$(py "import json; print(json.dumps({
    'name': 'Proof Bot',
    'bio': 'bot2bot proof',
    'webhookUrl': '''$INBOX_URL''',
    'telegram': 'proofbot',
    'whatsapp': '+15555550123',
    'imessage': '+15555550123',
  }))")"
)"
echo "$PAGE"
SLUG="$(echo "$PAGE" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success") is True, d; print(d["page"]["slug"])')"
OWNER="$(echo "$PAGE" | py 'import json,sys; print(json.load(sys.stdin)["ownerToken"])')"
PAGE_URL="$(echo "$PAGE" | py 'import json,sys; print(json.load(sys.stdin)["page"]["urls"]["page"])')"

echo "== discover contacts =="
CONTACT="$(curl -sS "$BASE/api/v1/pages/$SLUG/contact")"
echo "$CONTACT"
echo "$CONTACT" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("bot2bot") is True, d; ids=[c["id"] for c in d["contacts"]]; assert "cli" in ids and "telegram" in ids, d'

echo "== visitor bot posts a message =="
MSG="$(curl -sS -X POST "$BASE/api/v1/pages/$SLUG/message" \
  -H 'Content-Type: application/json' \
  -d '{"from":"visitor-bot","content":"hello from bot2bot-proof"}')"
echo "$MSG"
echo "$MSG" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("delivered") is True, d; assert d.get("ack")=="inbox-received", d'

echo "== owner inbox received webhook =="
GOT="$(curl -sS "$INBOX_URL")"
echo "$GOT"
echo "$GOT" | py 'import json,sys
d=json.load(sys.stdin)
assert d.get("count",0)>=1, d
payload=d["payloads"][-1]["payload"]
assert payload["event"]=="contact.message", payload
assert payload["message"]["from"]=="visitor-bot", payload
assert payload["message"]["content"]=="hello from bot2bot-proof", payload
print("ROUND_TRIP_OK")
'

echo
echo "PASS bot2bot round-trip"
echo "private_page=$PAGE_URL"
echo "slug=$SLUG"
echo "owner_token=$OWNER"
echo "inbox=$INBOX_URL"
