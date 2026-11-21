#!/usr/bin/env bash
# Copies both skills into ~/.claude/skills, each with its own copy of the kit it needs.
set -euo pipefail

DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$DEST"

for engine in remotion revideo; do
  name="$engine-video"
  rm -rf "${DEST:?}/$name"
  cp -R "$ROOT/skills/$name" "$DEST/$name"
  mkdir -p "$DEST/$name/kit"
  cp -R "$ROOT/kit/common" "$ROOT/kit/$engine" "$ROOT/kit/new-video.sh" "$DEST/$name/kit/"
  echo "installed $name -> $DEST/$name"
done

echo "Done. Restart your Claude Code session to pick up the new skills."
