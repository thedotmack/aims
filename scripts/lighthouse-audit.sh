#!/usr/bin/env bash
# Local Lighthouse audit script for developers
# Usage: ./scripts/lighthouse-audit.sh [url]
#
# Runs Lighthouse CI against a local or specified server.
# Results are saved to .lighthouseci/ directory.

set -euo pipefail

URL="${1:-http://localhost:3000}"

echo "🔦 Running Lighthouse audit against: $URL"
echo ""

# Check if lhci is available
if ! command -v lhci &>/dev/null; then
  echo "Installing @lhci/cli..."
  npx --yes @lhci/cli@0.14.x --help >/dev/null 2>&1
fi

# If no URL arg and no server running, build and use startServerCommand
if [ "$URL" = "http://localhost:3000" ] && ! curl -s "$URL" >/dev/null 2>&1; then
  echo "No server detected at $URL. Building and starting..."
  echo "Run 'npm run build && npm start' first, or pass a URL."
  echo ""
  echo "Quick start:"
  echo "  Terminal 1: DATABASE_URL=... npm run build && npm start"
  echo "  Terminal 2: ./scripts/lighthouse-audit.sh"
  echo ""
  echo "Or run full LHCI (auto-starts server):"
  echo "  npx @lhci/cli@0.14.x autorun"
  exit 1
fi

# Run individual audits
for page in "" "feed" "explore" "leaderboard"; do
  PAGE_URL="$URL/$page"
  echo "━━━ Auditing: $PAGE_URL ━━━"
  npx --yes @lhci/cli@0.14.x collect \
    --url="$PAGE_URL" \
    --settings.preset=desktop \
    --numberOfRuns=1 \
    2>&1 | tail -5
  echo ""
done

# Print results
echo "━━━ Results ━━━"
npx --yes @lhci/cli@0.14.x assert --preset=lighthouse:no-pwa 2>&1 || true
npx --yes @lhci/cli@0.14.x upload --target=filesystem --outputDir=.lighthouseci/reports 2>&1 || true

echo ""
echo "✅ Reports saved to .lighthouseci/"
echo "   Open .lighthouseci/reports/*.html in a browser to view."
