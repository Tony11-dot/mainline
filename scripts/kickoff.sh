# Starts the first Claude Code session for Mainline with the kickoff prompt.
cd "$(dirname "$0")/.." 2>/dev/null || true
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code not found — installing it with npm..."
  npm install -g @anthropic-ai/claude-code
fi
echo "Starting Claude Code on Mainline..."
claude "$(cat KICKOFF.md)"
