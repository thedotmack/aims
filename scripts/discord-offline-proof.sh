#!/usr/bin/env bash
# Offline e2e: simulate a Gateway @aims mention, HMAC-sign like the Fly worker,
# invoke the Vercel events route, mock the owner webhook, and assert the Discord
# REST reply is authored as @aims with the **botlord:** prefix.
# Usage: scripts/discord-offline-proof.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== discord offline proof (gateway mention → HMAC → Vercel → mock webhook → Discord REST) =="
npx vitest run tests/discord-gateway/offline-proof.test.ts
echo "PASS offline Discord e2e (CONTRACT/synthetic path; does not prove a live Gateway)"
