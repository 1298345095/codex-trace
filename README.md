# Codex Trace

> If you use Claude Code, see [claude-code-trace](https://github.com/delexw/claude-code-trace)

[![CI](https://github.com/PixelPaw-Labs/codex-trace/actions/workflows/ci.yml/badge.svg)](https://github.com/PixelPaw-Labs/codex-trace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.77.2%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/tauri-v2-24C8D8?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)](https://github.com/PixelPaw-Labs/codex-trace/releases)

A desktop + web viewer for [Codex CLI](https://github.com/openai/codex) session JSONL files. Built with [Tauri v2](https://v2.tauri.app/) (Rust backend + React frontend).

Reads session logs from `~/.codex/sessions/` and renders them as a scrollable turn list with expandable tool calls, token counts, and live tailing. Works as a **native desktop app** (macOS, Linux, Windows) or as a **web app** in any browser.

## Features

- **3-panel layout:** date-grouped session tree → turn list → turn detail
- **All tool kinds:** exec command, MCP tool, patch apply, web search, image generation, collab agent spawn/wait/close
- **Live tailing:** SSE-based updates for ongoing sessions
- **Collaboration tracking:** orchestrator + worker session linking
- **Three JSONL formats:** new (≥0.44), mid, and oldest (2025/08) session meta
- **Docker support:** headless web mode on port 1422

## Install

### Build from source

```bash
git clone https://github.com/PixelPaw-Labs/codex-trace.git
cd codex-trace
./script/install.sh       # builds frontend + installs Rust binary

codex-trace              # desktop app (default)
codex-trace --web        # web mode (opens browser)
```

### Run from source (no install)

```bash
git clone https://github.com/PixelPaw-Labs/codex-trace.git
cd codex-trace
npm install

npm run tauri dev        # desktop app with hot reload
npm run dev:web          # web mode (opens browser)
```

### Run in Docker (web mode only)

```bash
docker build -t codex-trace .
docker run --rm -p 1422:1422 \
  -v "$HOME/.codex/sessions:/home/app/.codex/sessions:ro" \
  codex-trace
# then open http://localhost:1422
```

Or with compose: `docker compose up --build`

## Session format

Reads `~/.codex/sessions/YYYY/MM/DD/rollout-{ISO_TIMESTAMP}-{UUID}.jsonl` files.

The sidebar reflects the folder structure exactly — date groups (YYYY/MM/DD) collapse and expand, with sessions shown underneath.

## Configuration

Press `,` to open Settings and change the sessions directory. Default: `~/.codex/sessions`.

Environment variables (for headless/Docker mode):

| Variable                | Default     | Description                    |
| ----------------------- | ----------- | ------------------------------ |
| `CODEXTRACE_HTTP_HOST`  | `127.0.0.1` | Bind host                      |
| `CODEXTRACE_HTTP_PORT`  | `11424`     | Bind port                      |
| `CODEXTRACE_STATIC_DIR` | —           | Path to built frontend `dist/` |

## Development

```bash
npm install
npm run dev          # Vite dev server (frontend only)
npm run tauri dev    # Full Tauri app

# Verify
npm run check        # tsc + oxlint + oxfmt + cargo clippy/fmt/test
```
