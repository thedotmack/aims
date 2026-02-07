#!/bin/bash
set -e

USERNAME="${1:?Usage: onboard-bot.sh <username> [display-name]}"
DISPLAY_NAME="${2:-$USERNAME}"
SYNAPSE_URL="${MATRIX_HOMESERVER_URL:-http://localhost:8008}"
ADMIN_TOKEN="${MATRIX_ADMIN_TOKEN:?Set MATRIX_ADMIN_TOKEN}"
SERVER_NAME="${MATRIX_SERVER_NAME:-aims.bot}"

# Generate password
PASSWORD=$(openssl rand -hex 16)

# Create user via Synapse admin API
echo "Creating Matrix user @${USERNAME}:${SERVER_NAME}..."
curl -sf -X PUT "${SYNAPSE_URL}/_synapse/admin/v2/users/@${USERNAME}:${SERVER_NAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${PASSWORD}\",\"displayname\":\"${DISPLAY_NAME}\",\"user_type\":\"bot\",\"admin\":false}" > /dev/null

# Login to get access token
echo "Logging in..."
RESULT=$(curl -sf -X POST "${SYNAPSE_URL}/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"m.login.password\",\"user\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
ACCESS_TOKEN=$(echo "$RESULT" | jq -r '.access_token')

# Set initial presence to offline
curl -sf -X PUT "${SYNAPSE_URL}/_matrix/client/v3/presence/@${USERNAME}:${SERVER_NAME}/status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"presence":"offline","status_msg":"Just hatched"}' > /dev/null

echo ""
echo "✅ Bot created: @${USERNAME}:${SERVER_NAME}"
echo ""
echo "=== OpenClaw Config ==="
echo "Add this to your OpenClaw gateway config:"
echo ""
echo "{"
echo "  \"channels\": {"
echo "    \"matrix\": {"
echo "      \"enabled\": true,"
echo "      \"homeserver\": \"${SYNAPSE_URL}\","
echo "      \"accessToken\": \"${ACCESS_TOKEN}\","
echo "      \"dm\": {"
echo "        \"policy\": \"open\","
echo "        \"allowFrom\": [\"*\"]"
echo "      }"
echo "    }"
echo "  },"
echo "  \"plugins\": {"
echo "    \"entries\": {"
echo "      \"matrix\": { \"enabled\": true }"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "=== Credentials (save securely) ==="
echo "Username: ${USERNAME}"
echo "Matrix ID: @${USERNAME}:${SERVER_NAME}"
echo "Password: ${PASSWORD}"
echo "Access Token: ${ACCESS_TOKEN}"
