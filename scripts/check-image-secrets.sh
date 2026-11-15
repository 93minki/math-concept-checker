#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  printf '사용법: %s <image>...\n' "$0" >&2
  exit 2
fi

failed=0
for image in "$@"; do
  printf '이미지 검사: %s\n' "$image"
  if ! docker image inspect "$image" --format '{{range .Config.Env}}{{println .}}{{end}}' |
    awk -F= '$1 !~ /^NEXT_PUBLIC_/ && $1 ~ /(SECRET|ADMIN_KEY|API_KEY)/ { bad=1 } END { exit bad ? 1 : 0 }'; then
    printf '이미지 환경 변수에 비밀값 관련 이름이 있거나 이미지를 읽지 못했습니다.\n' >&2
    failed=1
  fi
  if ! docker history --no-trunc --format '{{.CreatedBy}}' "$image" |
    awk '{ gsub(/NEXT_PUBLIC_[A-Z0-9_]+/, "", $0); if ($0 ~ /(SECRET|ADMIN_KEY|API_KEY)/) bad=1 } END { exit bad ? 1 : 0 }'; then
    printf '이미지 빌드 기록에 비밀값 관련 이름이 있거나 기록을 읽지 못했습니다.\n' >&2
    failed=1
  fi
  # Supabase 등 의존성에는 일반적인 접두어 문자열이 들어 있으므로
  # node_modules를 제외한 앱 결과물만 실제 비밀값 형태로 검사한다.
  # 매칭 내용은 비밀값일 수 있어 출력하지 않는다.
  if ! docker run --rm --network none --user 0 --entrypoint sh "$image" -c '
    set -eu
    env_paths=$(find / \( -path /proc -o -path /sys -o -path /dev \) -prune -o \( -type f -o -type l \) -name ".env*" -print)
    if [ -n "$env_paths" ]; then
      echo "이미지에 환경 변수 파일이 있습니다." >&2
      exit 1
    fi
    found_app=0
    for app_target in /app/.next /app/server.js /app/app; do
      if [ -e "$app_target" ]; then found_app=1; fi
    done
    if [ "$found_app" -eq 0 ]; then
      echo "검사할 앱 결과물이 없습니다." >&2
      exit 1
    fi
    for target in /app/.next /app/server.js /app/app /app/package.json /app/next.config.js /app/next.config.ts /app/.venv/pyvenv.cfg; do
      if [ -e "$target" ]; then
        if grep -rEI --exclude-dir=node_modules "sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{40,}" "$target" >/dev/null; then
          echo "앱 결과물에 비밀값 형태 문자열이 있습니다." >&2
          exit 1
        else
          result=$?
          if [ "$result" -ne 1 ]; then
            echo "앱 결과물을 읽지 못했습니다." >&2
            exit 1
          fi
        fi
      fi
    done
  '; then
    printf '이미지 파일 검사에 실패했습니다.\n' >&2
    failed=1
  fi
done
exit "$failed"
