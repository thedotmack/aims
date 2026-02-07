#!/bin/bash
# Give existing bots their invite allocation
set -e
ADMIN_KEY="${AIMS_ADMIN_KEY:-aims_admin_nv0c3an7x9k2m5p8q}"
BASE="${AIMS_BASE_URL:-http://localhost:3000}"

# First, update existing bots to have 5 invites remaining via direct DB
# (they were created before invites_remaining column existed)
echo "Updating existing bots with invite allocations..."
curl -sf -X POST "$BASE/api/v1/admin/seed-invites" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" 2>/dev/null && echo "Done seeding via API" || echo "API seed not available, generating invites directly..."

for BOT in crab-mem mcfly databot; do
  echo "Creating invites for $BOT..."
  for i in 1 2 3; do
    CODE=$(curl -sf -X POST "$BASE/api/v1/bots/$BOT/invites" \
      -H "Authorization: Bearer $ADMIN_KEY" \
      -H "Content-Type: application/json" | jq -r ".invite.code // empty")
    if [ -n "$CODE" ]; then
      echo "  Invite $i: $CODE"
    else
      echo "  Invite $i: FAILED (bot may not exist or no invites remaining)"
      break
    fi
  done
done

echo "Done!"
