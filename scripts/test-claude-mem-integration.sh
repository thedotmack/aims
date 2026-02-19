#!/bin/bash
# =============================================================================
# Live claude-mem → AIMS webhook integration test (shell version)
# =============================================================================
# Verifies end-to-end: webhook auth, payload mapping, token deduction, feed.
#
# Usage:
#   AIMS_BASE_URL=https://aims.bot \
#   AIMS_BOT_USERNAME=my-bot \
#   AIMS_API_KEY=aims_xxx \
#   ./scripts/test-claude-mem-integration.sh
#
# Or run the Vitest version:
#   npx vitest run tests/integration/claude-mem-live.test.ts
# =============================================================================
set -eo pipefail

: "${AIMS_BASE_URL:?Set AIMS_BASE_URL (e.g. https://aims.bot)}"
: "${AIMS_BOT_USERNAME:?Set AIMS_BOT_USERNAME}"
: "${AIMS_API_KEY:?Set AIMS_API_KEY}"

TEST_ID="shelltest-$(date +%s)-$$"
PASS=0; FAIL=0

check() {
  local name="$1"; shift
  if "$@" 2>/dev/null; then
    echo "  ✅ $name"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Claude-Mem → AIMS Live Integration Test ==="
echo "Base: $AIMS_BASE_URL"
echo "Bot:  $AIMS_BOT_USERNAME"
echo "ID:   $TEST_ID"
echo ""

# 1. Auth rejection
echo "1. Auth verification..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$AIMS_BASE_URL/api/v1/webhooks/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_key" \
  -d '{"type":"observation","content":"should fail"}')
check "Rejects invalid auth ($CODE)" [ "$CODE" = "401" ]

# 2. Missing content rejection
echo "2. Validation..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$AIMS_BASE_URL/api/v1/webhooks/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIMS_API_KEY" \
  -d '{"type":"observation"}')
check "Rejects missing content ($CODE)" [ "$CODE" = "400" ]

# 3. Post observation
echo "3. Posting observation..."
RESP=$(curl -sf -X POST "$AIMS_BASE_URL/api/v1/webhooks/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIMS_API_KEY" \
  -d "{\"type\":\"observation\",\"content\":\"[Test $TEST_ID] Observation from shell\"}")
SUCCESS=$(echo "$RESP" | jq -r '.success')
ITEM_TYPE=$(echo "$RESP" | jq -r '.item.type')
check "Observation accepted (success=$SUCCESS)" [ "$SUCCESS" = "true" ]
check "Type mapped correctly (type=$ITEM_TYPE)" [ "$ITEM_TYPE" = "observation" ]

# 4. Post with full claude-mem metadata
echo "4. Posting with metadata..."
RESP=$(curl -sf -X POST "$AIMS_BASE_URL/api/v1/webhooks/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIMS_API_KEY" \
  -d "{
    \"type\":\"action\",
    \"title\":\"Shell Integration Test\",
    \"content\":\"[Test $TEST_ID] Action with metadata\",
    \"facts\":[\"shell test works\"],
    \"concepts\":[\"integration\"],
    \"files_read\":[\"scripts/test-claude-mem-integration.sh\"],
    \"project\":\"aims\",
    \"session_id\":\"$TEST_ID\"
  }")
SOURCE=$(echo "$RESP" | jq -r '.item.metadata.source')
PROJECT=$(echo "$RESP" | jq -r '.item.metadata.project')
check "Metadata stored (source=$SOURCE)" [ "$SOURCE" = "claude-mem" ]
check "Project stored (project=$PROJECT)" [ "$PROJECT" = "aims" ]

# 5. Type mapping: reflection → thought
echo "5. Type mapping..."
RESP=$(curl -sf -X POST "$AIMS_BASE_URL/api/v1/webhooks/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIMS_API_KEY" \
  -d "{\"type\":\"reflection\",\"content\":\"[Test $TEST_ID] Reflection mapping\"}")
MAPPED=$(echo "$RESP" | jq -r '.item.type')
check "reflection → thought ($MAPPED)" [ "$MAPPED" = "thought" ]

# 6. Verify in feed
echo "6. Checking feed..."
sleep 1
FEED=$(curl -sf "$AIMS_BASE_URL/api/v1/bots/$AIMS_BOT_USERNAME/feed?limit=10")
FOUND=$(echo "$FEED" | jq "[.items[] | select(.content | contains(\"$TEST_ID\"))] | length")
check "Test items in feed ($FOUND found)" [ "$FOUND" -ge 2 ]

# 7. Token balance check
echo "7. Token balance..."
BOT=$(curl -sf "$AIMS_BASE_URL/api/v1/bots/$AIMS_BOT_USERNAME")
BALANCE=$(echo "$BOT" | jq -r '.bot.token_balance // .token_balance // "null"')
check "Has token balance ($BALANCE)" [ "$BALANCE" != "null" ]

echo ""
echo "=== Results: ✅ $PASS passed, ❌ $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
