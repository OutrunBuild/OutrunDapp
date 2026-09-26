#!/usr/bin/env bash
# 生产预览重启（progress.md 部署纪律：重建与运行中 server 不可并发；
# 重建前按 PID kill 旧 next start（禁 pkill -f），build 后 4175 重启）。
# 用法：bash scripts/restart-prod-4175.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) 按端口定位旧 4175 生产 server 并 kill
old_pid=$(ss -ltnp | grep '127.0.0.1:4175' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [ -n "${old_pid:-}" ]; then
  echo "kill 旧 4175 server pid=$old_pid"
  kill "$old_pid"
  for _ in $(seq 1 20); do
    ss -ltn | grep -q '127.0.0.1:4175' || break
    sleep 0.5
  done
fi

# 2) 重建生产产物
pnpm build

# 3) 4175 重启（绑 127.0.0.1 对齐旧部署口径；setsid 脱离当前会话；日志 /tmp/outrun-4175.log）
setsid bash -c 'PORT=4175 exec pnpm exec next start -H 127.0.0.1' >/tmp/outrun-4175.log 2>&1 </dev/null &
for _ in $(seq 1 20); do
  ss -ltn | grep -q ':4175' && break
  sleep 0.5
done
if ss -ltn | grep -q ':4175'; then
  echo "4175 已监听"
else
  echo "4175 未监听，日志尾："
  tail -5 /tmp/outrun-4175.log
  exit 1
fi
