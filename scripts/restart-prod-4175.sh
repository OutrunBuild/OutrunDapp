#!/usr/bin/env bash
# Production preview restart (deployment discipline: rebuild and a running server must
# not be concurrent; kill the old next start by PID before rebuilding (pkill -f forbidden);
# restart on 4175 after build).
# Usage: bash scripts/restart-prod-4175.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) locate and kill the old 4175 production server by port
old_pid=$(ss -ltnp | grep '127.0.0.1:4175' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [ -n "${old_pid:-}" ]; then
  echo "kill old 4175 server pid=$old_pid"
  kill "$old_pid"
  for _ in $(seq 1 20); do
    ss -ltn | grep -q '127.0.0.1:4175' || break
    sleep 0.5
  done
fi

# 2) rebuild production artifacts
pnpm build

# 3) restart on 4175 (same 127.0.0.1 binding as the previous deployment; setsid detaches from the
# current session; log /tmp/outrun-4175.log)
setsid bash -c 'PORT=4175 exec pnpm exec next start -H 127.0.0.1' >/tmp/outrun-4175.log 2>&1 </dev/null &
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
