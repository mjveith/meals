#!/bin/sh
# Meals app launcher
export HOME=/Users/koda
cd /Users/koda/.openclaw/workspace/projects/meals/app

if [ ! -f .next/BUILD_ID ]; then
  /opt/homebrew/bin/npm run build || exit 1
fi

exec ./node_modules/.bin/next start -H 0.0.0.0 -p 3103
