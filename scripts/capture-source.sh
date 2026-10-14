#!/usr/bin/env bash
# Capture protocol: URL, locale en-US,
# prefers-reduced-motion=reduce, ~2s settle, viewport 1440x900 / 390x844.
# Uses the chromium headless-shell installed by playwright 1.62.1 with
# --force-prefers-reduced-motion (playwright CLI has no reduced-motion flag;
# this keeps the protocol's reduced-motion requirement machine-enforced).
# --use-gl=swiftshader is REQUIRED in this WSL env: the default GL backend
# wedges the screenshot compositor after headful sessions.
# NSS/NSPR come from user-local debs in ~/.cache/pw-libs — no sudo, no
# project deps written.
# Usage: bash scripts/capture-source.sh <URL> <OUT_FILE> <WIDTH,HEIGHT>
set -euo pipefail

URL="${1:?url}"
OUT="${2:?output png path}"
SIZE="${3:?viewport WxH e.g. 1440,900}"

LIB_ROOT="$HOME/.cache/pw-libs/root/usr/lib/x86_64-linux-gnu"
SHELL_BIN="$HOME/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"
[ -e "$LIB_ROOT/libnss3.so" ] || { echo "missing user-local libs under ~/.cache/pw-libs" >&2; exit 1; }
[ -x "$SHELL_BIN" ] || { echo "missing $SHELL_BIN — playwright install chromium first" >&2; exit 1; }

export LD_LIBRARY_PATH="$LIB_ROOT${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

"$SHELL_BIN" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --use-gl=swiftshader \
  --screenshot="$OUT" --window-size="$SIZE" \
  --force-prefers-reduced-motion --virtual-time-budget=2000 \
  --lang=en-US --timeout=30000 "$URL" 2>/dev/null

[ -s "$OUT" ] || { echo "capture produced empty file: $OUT" >&2; exit 1; }
echo "captured: $OUT ($(stat -c %s "$OUT") bytes)"
