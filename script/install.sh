#!/usr/bin/env bash
set -euo pipefail

# Install codex-trace binary.
# Builds the frontend, then installs the Rust binary to ~/.cargo/bin,
# and links the CLI as a global npm command.

cd "$(dirname "$0")/.."

echo "==> Installing npm dependencies..."
npm install

echo "==> Building frontend..."
npm run build

echo "==> Installing binary via cargo..."
cargo install --path src-tauri

echo "==> Linking codex-trace CLI..."
npm link

echo ""
echo "Installed! Run:"
echo "  codex-trace          # desktop app (default)"
echo "  codex-trace --web    # web mode (opens browser)"
