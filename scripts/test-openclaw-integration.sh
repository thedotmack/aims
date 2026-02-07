#!/bin/bash
# Test AIMS ↔ OpenClaw integration endpoints
set -e

BASE="${AIMS_BASE_URL:-https://aims.bot}"
ADMIN_KEY="${AIMS_ADMIN_KEY:-aims_admin_nv0c3an7x9k2m5p8q}"

echo "=== AIMS OpenClaw Integration Test ==="
echo "Base: $BASE"
echo ""

# 1. Create test chat room
echo "1. Creating test chat room..."
CHAT=$(curl -sf -X POST "$BASE/api/v1/chats" \
  -H "Content-Type: application/json" \
  -d '{"title":"OpenClaw Integration Test"}')
KEY=$(echo "$CHAT" | jq -r '.chat.key')
echo "   Chat key: $KEY"

# 2. Register webhook
echo "2. Registering webhook..."
WH=$(curl -sf -X POST "$BASE/api/v1/webhooks" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://httpbin.org/post\",\"chatKey\":\"$KEY\",\"events\":[\"message.created\"]}")
WH_ID=$(echo "$WH" | jq -r '.webhook.id')
echo "   Webhook ID: $WH_ID"

# 3. List webhooks
echo "3. Listing webhooks..."
WH_LIST=$(curl -sf "$BASE/api/v1/webhooks" \
  -H "Authorization: Bearer $ADMIN_KEY")
WH_COUNT=$(echo "$WH_LIST" | jq '.webhooks | length')
echo "   Webhooks: $WH_COUNT"

# 4. Send user message (should trigger webhook)
echo "4. Sending user message..."
MSG=$(curl -sf -X POST "$BASE/api/v1/chats/$KEY/messages" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","content":"Hello from integration test!"}')
echo "   Message: $(echo "$MSG" | jq -r '.message.id')"

# 5. Send bot message
echo "5. Sending bot message..."
BOT_MSG=$(curl -sf -X POST "$BASE/api/v1/chats/$KEY/messages" \
  -H "Content-Type: application/json" \
  -d '{"username":"crab-mem","content":"Hello human!","is_bot":true}')
IS_BOT=$(echo "$BOT_MSG" | jq -r '.message.isBot')
echo "   Bot flag: $IS_BOT"

# 6. Read messages
echo "6. Reading messages..."
MESSAGES=$(curl -sf "$BASE/api/v1/chats/$KEY/messages")
MSG_COUNT=$(echo "$MESSAGES" | jq '.messages | length')
echo "   Messages: $MSG_COUNT"

# 7. Delete webhook
echo "7. Cleaning up webhook..."
curl -sf -X DELETE "$BASE/api/v1/webhooks/$WH_ID" \
  -H "Authorization: Bearer $ADMIN_KEY" > /dev/null
echo "   Deleted"

# 8. Verify webhook admin auth
echo "8. Testing auth rejection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/webhooks")
if [ "$HTTP_CODE" = "401" ]; then
  echo "   ✅ Unauthorized correctly rejected"
else
  echo "   ❌ Expected 401, got $HTTP_CODE"
fi

echo ""
echo "=== Results ==="
PASS=0; FAIL=0
[ -n "$KEY" ] && ((PASS++)) || ((FAIL++))
[ -n "$WH_ID" ] && ((PASS++)) || ((FAIL++))
[ "$WH_COUNT" -ge 1 ] 2>/dev/null && ((PASS++)) || ((FAIL++))
[ "$MSG_COUNT" -ge 2 ] 2>/dev/null && ((PASS++)) || ((FAIL++))
[ "$IS_BOT" = "true" ] && ((PASS++)) || ((FAIL++))
[ "$HTTP_CODE" = "401" ] && ((PASS++)) || ((FAIL++))
echo "✅ Passed: $PASS  ❌ Failed: $FAIL"
