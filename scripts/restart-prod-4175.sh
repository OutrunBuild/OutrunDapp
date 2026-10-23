#!/usr/bin/env bash
# Production preview restart (deployment discipline: rebuild and a running server must
# not be concurrent; kill the old next start by PID before rebuilding (pkill -f forbidden);
# restart on 4175 after build).
# Usage: bash scripts/restart-prod-4175.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) locate and kill the old 4175 production server by port (any binding: *:4175 or host:4175)
old_pid=$(ss -ltnp | grep ':4175' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [ -n "${old_pid:-}" ]; then
  echo "kill old 4175 server pid=$old_pid"
  kill "$old_pid"
  for _ in $(seq 1 20); do
    ss -ltn | grep -q ':4175' || break
    sleep 0.5
  done
fi

# 2) rebuild production artifacts — the preview is the ONCHAIN build.
#    OUTRUN_DATA_SOURCE=onchain is a build-time pin: next.config.ts mirrors it into
#    NEXT_PUBLIC_ (client inlining) and aliases the fixture repository to the onchain
#    adapter. A plain `pnpm build` silently downgrades the preview to the fixture build,
#    where the Login button is wired to the e2e harness toggle (instant fake connect to
#    the fixture demo address) instead of opening the wallet selector dialog.
OUTRUN_DATA_SOURCE=onchain pnpm build

# 2b) mode guard: the client bundle must NOT carry the unresolved env reference —
# its presence means the artifact came out fixture (Login wired to the e2e harness
# toggle, instant fake connect); refuse to serve a silently downgraded preview.
if grep -qr "NEXT_PUBLIC_OUTRUN_DATA_SOURCE" .next/static/chunks/; then
  echo "mode guard FAILED: fixture-mode artifact (onchain env pin lost?) — refusing to start"
  exit 1
fi

# 3) restart on 4175 — -p only, all interfaces: -H 127.0.0.1 degrades proxy.ts rewrites
# into a 307 self-redirect loop (all-interface -p is the ruling); setsid detaches from
# the current session; log /tmp/outrun-4175.log. The runtime env mirrors the build pin
# (same convention the previous onchain servers ran with).
setsid bash -c 'OUTRUN_DATA_SOURCE=onchain exec pnpm exec next start -p 4175' >/tmp/outrun-4175.log 2>&1 </dev/null &
for _ in $(seq 1 20); do
  ss -ltn | grep -q ':4175' && break
  sleep 0.5
done
if ss -ltn | grep -q ':4175'; then
  echo "4175 is listening"
else
  echo "4175 not listening; log tail:"
  tail -5 /tmp/outrun-4175.log
  exit 1
fi
