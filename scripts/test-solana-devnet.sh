#!/usr/bin/env bash
# =============================================================================
# Solana Devnet Integration Test — Shell-based verification
# =============================================================================
# Usage:
#   # Connectivity only:
#   SOLANA_RPC_URL=https://api.devnet.solana.com ./scripts/test-solana-devnet.sh
#
#   # Full (with funded keypair):
#   SOLANA_RPC_URL=https://api.devnet.solana.com \
#   SOLANA_KEYPAIR='[1,2,3,...,64]' \
#   ./scripts/test-solana-devnet.sh
#
# Prerequisites: curl, jq
# Exit code: 0 = all checks passed, 1 = failure
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
SKIP=0

check() {
  local name="$1"; shift
  if "$@"; then
    echo "  ✅ $name"
    ((PASS++))
  else
    echo "  ❌ $name"
    ((FAIL++))
  fi
}

skip() {
  echo "  ⏭️  $1 (skipped — missing env)"
  ((SKIP++))
}

echo ""
echo "🔗 Solana Devnet Integration Checks"
echo "======================================"

# --- RPC connectivity ---
if [[ -z "${SOLANA_RPC_URL:-}" ]]; then
  echo ""
  echo "⚠️  SOLANA_RPC_URL not set — skipping all checks."
  echo "   Set it to https://api.devnet.solana.com to run."
  exit 0
fi

echo ""
echo "1. RPC Connectivity (${SOLANA_RPC_URL})"

check "getVersion responds" bash -c '
  RESP=$(curl -s -X POST "${SOLANA_RPC_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getVersion\"}")
  echo "$RESP" | jq -e ".result[\"solana-core\"]" > /dev/null
'

check "getSlot returns positive number" bash -c '
  RESP=$(curl -s -X POST "${SOLANA_RPC_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSlot\"}")
  SLOT=$(echo "$RESP" | jq -r ".result")
  [[ "$SLOT" -gt 0 ]]
'

check "getHealth returns ok" bash -c '
  RESP=$(curl -s -X POST "${SOLANA_RPC_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getHealth\"}")
  echo "$RESP" | jq -e ".result == \"ok\"" > /dev/null
'

# --- Keypair checks ---
echo ""
if [[ -z "${SOLANA_KEYPAIR:-}" ]]; then
  echo "2. Keypair Checks (SOLANA_KEYPAIR not set)"
  skip "Parse keypair"
  skip "Wallet balance"
  skip "Memo transaction"
else
  echo "2. Keypair & Balance"

  # Extract pubkey using node one-liner
  PUBKEY=$(node -e "
    const { Keypair } = require('@solana/web3.js');
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_KEYPAIR)));
    console.log(kp.publicKey.toBase58());
  " 2>/dev/null || echo "")

  if [[ -z "$PUBKEY" ]]; then
    echo "  ❌ Parse keypair — could not extract public key"
    ((FAIL++))
  else
    check "Parse keypair → ${PUBKEY}" true

    check "Wallet balance ≥ 0.001 SOL" bash -c "
      RESP=\$(curl -s -X POST '${SOLANA_RPC_URL}' \
        -H 'Content-Type: application/json' \
        -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"${PUBKEY}\"]}')
      BAL=\$(echo \"\$RESP\" | jq -r '.result.value')
      [[ \"\$BAL\" -ge 1000000 ]]
    "
  fi
fi

# --- Summary ---
echo ""
echo "======================================"
echo "Results: ✅ $PASS passed, ❌ $FAIL failed, ⏭️  $SKIP skipped"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
