#!/bin/bash
# 정글 식당 실행: 식단 API 서버 2대(:8001, :8002) + 프록시(:8000)
# Ctrl+C로 프록시를 끄면 백엔드도 함께 종료된다.
#
#   bash run.sh
#   → 브라우저에서 http://localhost:8000/
#
# tiny 위치가 다르면: TINY=/경로/tiny bash run.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
TINY="${TINY:-$ROOT/../w13-mini-web-server-team/tiny/tiny}"

if [ ! -x "$TINY" ]; then
    echo "tiny를 찾을 수 없어요: $TINY" >&2
    echo "웹 서버 저장소의 tiny 폴더에서 make를 하거나, TINY=/경로/tiny bash run.sh 로 실행하세요." >&2
    exit 1
fi

for port in 8000 8001 8002; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
        echo "포트 $port가 이미 사용 중이에요. pkill tiny 로 정리한 뒤 다시 실행하세요." >&2
        exit 1
    fi
done

mkdir -p "$ROOT/logs"

# 백엔드: 각 폴더가 웹 루트. api/menu.txt는 둘 다 menu-api/menu.txt를 가리키는 링크
(cd "$ROOT/menu-api/backend1" && exec "$TINY" 8001) >"$ROOT/logs/backend1.log" 2>&1 &
B1=$!
(cd "$ROOT/menu-api/backend2" && exec "$TINY" 8002) >"$ROOT/logs/backend2.log" 2>&1 &
B2=$!

cleanup() {
    kill "$B1" "$B2" 2>/dev/null
    wait "$B1" "$B2" 2>/dev/null
    echo "백엔드를 종료했어요."
}
trap cleanup EXIT

echo "backend1  http://localhost:8001  (로그: logs/backend1.log)"
echo "backend2  http://localhost:8002  (로그: logs/backend2.log)"
echo "proxy     http://localhost:8000  ← 브라우저에서 여기로 접속"
echo "종료: Ctrl+C"
echo

# 프록시: web/이 웹 루트, /api/*는 백엔드로
cd "$ROOT/web"
"$TINY" 8000 -c "$ROOT/routes.conf"