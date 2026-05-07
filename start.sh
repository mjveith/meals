#!/bin/sh
# Meals dev-lane launcher. Live must use ../deploy/start-live.sh + app-live.
set -eu
export HOME=/Users/koda
export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
APP_DIR=/Users/koda/.openclaw/workspace/projects/meals/app
DATA_DIR=/Users/koda/.openclaw/workspace/projects/meals/shared-state
PORT=${PORT:-3113}
cd "$APP_DIR"
mkdir -p "$DATA_DIR"
# Always rebuild before serving so manual dev starts cannot expose a stale .next artifact.
MEALS_DATA_DIR="$DATA_DIR" npm run build || exit 1
exec env MEALS_DATA_DIR="$DATA_DIR" ./node_modules/.bin/next start -H 0.0.0.0 -p "$PORT"
