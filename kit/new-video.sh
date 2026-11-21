#!/usr/bin/env bash
# Make a new video project from the kit.
#   ./new-video.sh remotion ~/videos/my-first-short
#   ./new-video.sh revideo  ~/videos/my-first-short
set -euo pipefail

ENGINE="${1:-}"
DEST="${2:-}"
KIT="$(cd "$(dirname "$0")" && pwd)"

if [[ "$ENGINE" != "remotion" && "$ENGINE" != "revideo" ]] || [[ -z "$DEST" ]]; then
  echo "usage: new-video.sh <remotion|revideo> <new-folder>" >&2
  exit 1
fi
if [[ -e "$DEST" ]] && [[ -n "$(ls -A "$DEST" 2>/dev/null)" ]]; then
  echo "$DEST already exists and is not empty. Pick a new folder." >&2
  exit 1
fi

mkdir -p "$DEST/public/fonts" "$DEST/src"
cp -R "$KIT/$ENGINE/." "$DEST/"
cp "$KIT/common/narrate.py" "$KIT/common/script.json" "$DEST/"
cp "$KIT/common/fonts/"* "$DEST/public/fonts/"
echo "created $DEST ($ENGINE)"
echo "next: cd $DEST && npm install && edit script.json && python3 narrate.py && npm run render"
