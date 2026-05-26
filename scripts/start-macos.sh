#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Dependencies are missing. Run ./scripts/setup-macos.sh first."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Fill in DEEPSEEK_API_KEY for AI features."
fi

echo "Starting AI PPT..."
echo "Open: http://127.0.0.1:5173/"
echo "Stop: press Ctrl + C in this terminal."
echo ""

npm run dev
