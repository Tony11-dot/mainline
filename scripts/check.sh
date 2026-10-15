#!/bin/sh
# Every check CI runs, on this Mac: what each PR passes before it's merged while CI is manual-only.
#   sh scripts/check.sh
set -e
cd "$(dirname "$0")/.."
# Node 22 for this run only (Capacitor 8, Vitest 5); the shell's default is left alone.
v22=$(ls "$HOME/.nvm/versions/node" 2>/dev/null | grep '^v22' | tail -1)
[ -n "$v22" ] && PATH="$HOME/.nvm/versions/node/$v22/bin:$PATH"
node -v | grep -q '^v22' || { echo "Node 22 is required: nvm install 22"; exit 1; }
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @mainline/web build
node scripts/check-budgets.mjs
pnpm --filter @mainline/api build
(cd apps/web && node scripts/i18n.mjs --check)
pnpm e2e
echo "All checks passed."
