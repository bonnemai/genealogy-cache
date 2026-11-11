#!/usr/bin/env bash
set -euo pipefail

mode="${1:-local}"
port="${PORT:-3000}"
image="genealogy-cache:local"

case "$mode" in
  local)
    exec npm start
    ;;
  docker)
    docker build -t "$image" .
    exec docker run --rm -it -p "${port}:3000" -e PORT=3000 "$image"
    ;;
  macos)
    docker build --platform linux/arm64 -t "$image" .
    exec docker run --rm -it --platform linux/arm64 -p "${port}:3000" -e PORT=3000 "$image"
    ;;
  *)
    echo "Usage: $0 [local|docker|macos]" >&2
    exit 2
    ;;
esac
