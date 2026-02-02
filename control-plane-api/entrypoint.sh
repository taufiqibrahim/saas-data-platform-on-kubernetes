#!/bin/sh
set -e

# If CMD arguments are passed (e.g. "temporal" or "api"), prefer that
if [ -n "$1" ]; then
  TARGET="$1"
fi

case "$TARGET" in
  temporal)
    echo "🌀 Starting Temporal Worker..."
    exec node dist/temporal/workers/worker.worker.js
    ;;
  api|*)
    echo "🚀 Starting API Server..."
    exec node dist/index.js
    ;;
esac
