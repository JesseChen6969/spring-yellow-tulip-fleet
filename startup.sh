#!/bin/sh
# Revive the preview dev server. Idempotent: exit if already healthy.
set -e
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
if [ -f /tmp/app-dev.pid ] && kill -0 "$(cat /tmp/app-dev.pid)" 2>/dev/null; then
  exit 0
fi
nohup npm run dev > /tmp/app-dev.log 2>&1 &
echo $! > /tmp/app-dev.pid
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done
echo "dev server did not become healthy" >&2
exit 1
