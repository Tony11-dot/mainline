#!/usr/bin/env bash
# Puts pasted API keys where they belong without them ever passing through a chat:
#   secrets/paste-here.env  →  local .env  +  Railway (service "api")  +  GitHub Actions secrets.
# Also copies ClassMate's Google Play service account for MainLine uploads.
# Usage: bash scripts/apply-secrets.sh   (the paste file is emptied afterwards)
set -euo pipefail
cd "$(dirname "$0")/.."

PASTE=secrets/paste-here.env
REPO=Tony11-dot/mainline
PLAY_SRC="$HOME/Dev/classmate/apps/classmate_mobile/fastlane/play-service-account.json"

# 1. Play service account (shared with ClassMate).
if [[ -f "$PLAY_SRC" && ! -f secrets/play-service-account.json ]]; then
  install -m 600 "$PLAY_SRC" secrets/play-service-account.json
fi
if [[ -f secrets/play-service-account.json ]]; then
  gh secret set PLAY_SERVICE_ACCOUNT_JSON -R "$REPO" < secrets/play-service-account.json
  echo "✓ Play service account → GitHub secret PLAY_SERVICE_ACCOUNT_JSON"
  echo "  Give this address access in Play Console (Users and permissions):"
  echo "  $(node -p "require('./secrets/play-service-account.json').client_email")"
fi

# 2. Pasted API keys.
[[ -f "$PASTE" ]] || { echo "No $PASTE — nothing else to apply."; exit 0; }
applied=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  key="${line%%=*}"; val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"; val="${val%"${val##*[![:space:]]}"}"
  val="${val%\"}"; val="${val#\"}"
  [[ -z "$val" ]] && continue
  case "$key" in
    LICHESS_FALLBACK_TOKEN|GEMINI_API_KEY|GROQ_API_KEY) ;;
    *) echo "✗ skipping unknown key $key"; continue ;;
  esac
  # Local .env: replace the line, or append it.
  KEY="$key" VAL="$val" node -e '
    const fs = require("fs"); const { KEY, VAL } = process.env;
    let s = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
    const re = new RegExp(`^${KEY}=.*$`, "m");
    s = re.test(s) ? s.replace(re, () => `${KEY}=${VAL}`) : s + (s.endsWith("\n") || !s ? "" : "\n") + `${KEY}=${VAL}\n`;
    fs.writeFileSync(".env", s, { mode: 0o600 });'
  railway variables --service api --skip-deploys --set "$key=$val" >/dev/null
  echo "✓ $key → .env + Railway"
  applied=$((applied + 1))
done < "$PASTE"

if (( applied > 0 )); then
  railway redeploy --service api --yes >/dev/null && echo "✓ Railway redeploying with the new keys"
fi
# Empty the paste file so the keys live only in .env / Railway.
: > "$PASTE"
echo "Done. $PASTE is now empty."
