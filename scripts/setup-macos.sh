#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== AI PPT macOS setup =="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  if command -v brew >/dev/null 2>&1; then
    echo "Install it with: brew install node"
  else
    echo "Install Node.js 20+ from: https://nodejs.org/"
  fi
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed. Reinstall Node.js 20+ from https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is recommended. Current version: $(node -v)"
  echo "Please upgrade Node.js, then run this script again."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

echo "Installing dependencies..."
npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
else
  echo ".env already exists, keeping it unchanged."
fi

if grep -q "replace_with_your_deepseek_key" .env; then
  echo ""
  echo "Next step: open .env and fill in DEEPSEEK_API_KEY."
  echo "Example:"
  echo "  DEEPSEEK_API_KEY=sk-..."
else
  echo "DeepSeek key appears to be configured."
fi

echo ""
echo "Setup finished."
echo "Start the app with:"
echo "  ./scripts/start-macos.sh"

