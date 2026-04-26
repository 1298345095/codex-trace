#!/bin/bash
# Pre-commit hook: check format, lint, and Rust; block commit if issues found.
# Claude Code will receive the block reason and must fix before retrying.

set -uo pipefail

HOOK_INPUT=$(cat)
SESSION_ID=$(printf '%s' "$HOOK_INPUT" | jq -r '.session_id // ""')
FLAG_FILE="/tmp/claude-tests-confirmed${SESSION_ID:+-$SESSION_ID}"

cd "$CLAUDE_PROJECT_DIR"

STAGED=$(git diff --cached --name-only)

if [ -z "$STAGED" ]; then
  exit 0
fi

ERRORS=""

# --- Format check ---
FMT_OUTPUT=$(npm run fmt:check 2>&1) || {
  ERRORS="Format issues found. Run: npm run fmt, do not ask user for options, ⚠️  STAGE THE FIXED FILES in a SEPARATE Bash tool call: git add <files>\nThen retry the commit in another Bash tool call.\n\n$FMT_OUTPUT"
}

# --- Lint check ---
LINT_OUTPUT=$(npm run lint 2>&1)
LINT_EXIT=$?
if [ $LINT_EXIT -ne 0 ] || echo "$LINT_OUTPUT" | grep -qE "[1-9][0-9]* warnings? "; then
  if [ -n "$ERRORS" ]; then
    ERRORS="$ERRORS\n\nLint issues:\n$LINT_OUTPUT"
  else
    ERRORS="Lint issues found. Fix each issue properly at the root cause — do NOT add eslint-disable comments or suppress rules. ⚠️  STAGE THE FIXED FILES in a SEPARATE Bash tool call: git add <files>\nThen retry the commit in another Bash tool call.\n\n$LINT_OUTPUT"
  fi
fi

# --- TypeScript check ---
TS_OUTPUT=$(npx tsc --noEmit 2>&1) || {
  if [ -n "$ERRORS" ]; then
    ERRORS="$ERRORS\n\nTypeScript errors:\n$TS_OUTPUT"
  else
    ERRORS="TypeScript errors found. Fix them properly.\n⚠️  STAGE THE FIXED FILES in a SEPARATE Bash tool call: git add <files>\nThen retry the commit in another Bash tool call.\n\n$TS_OUTPUT"
  fi
}

# --- Rust checks (only if Rust files staged) ---
if echo "$STAGED" | grep -q "src-tauri/"; then
  RUST_FMT=$(cargo fmt --manifest-path src-tauri/Cargo.toml --check 2>&1) || {
    if [ -n "$ERRORS" ]; then
      ERRORS="$ERRORS\n\nRust format issues:\n$RUST_FMT"
    else
      ERRORS="Rust format issues found. Run: cargo fmt --manifest-path src-tauri/Cargo.toml, ⚠️  STAGE THE FIXED FILES in a SEPARATE Bash tool call: git add <files>\nThen retry the commit in another Bash tool call.\n\n$RUST_FMT"
    fi
  }

  CLIPPY_OUTPUT=$(cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings 2>&1) || {
    if [ -n "$ERRORS" ]; then
      ERRORS="$ERRORS\n\nRust clippy issues:\n$CLIPPY_OUTPUT"
    else
      ERRORS="Rust clippy issues found. Fix each issue properly — do NOT add #[allow(...)] unless it is a genuine false positive.\n⚠️  STAGE THE FIXED FILES in a SEPARATE Bash tool call: git add <files>\nThen retry the commit in another Bash tool call.\n\n$CLIPPY_OUTPUT"
    fi
  }
fi

if [ -n "$ERRORS" ]; then
  printf '{"decision": "block", "reason": %s}' "$(printf '%s' "$ERRORS" | jq -Rs .)"
  exit 0
fi

# --- Self-reflection gate ---
if [ -f "$FLAG_FILE" ]; then
  rm -f "$FLAG_FILE"
  exit 0
fi

REFLECTION="All checks pass. Did you write or update tests for the behaviour you just changed?\n\n  If not → write the tests then in a SEPARATE Bash tool call: git add <files>, then retry.\n  If yes → run this in a SEPARATE Bash tool call, then retry the commit in another:\n\n    touch $FLAG_FILE"
printf '{"decision": "block", "reason": %s}' "$(printf '%s' "$REFLECTION" | jq -Rs .)"
