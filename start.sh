#!/bin/sh
# Meals dev-lane launcher. Live must use ../deploy/start-live.sh + app-live.
set -eu

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR=${MEALS_DATA_DIR:-"$APP_DIR/../shared-state"}
PORT=${PORT:-3113}

cd "$APP_DIR"
mkdir -p "$DATA_DIR"

# Always rebuild before serving so manual dev starts cannot expose a stale .next artifact.
MEALS_DATA_DIR="$DATA_DIR" npm run build || exit 1
exec env MEALS_DATA_DIR="$DATA_DIR" ./node_modules/.bin/next start -H 0.0.0.0 -p "$PORT"
