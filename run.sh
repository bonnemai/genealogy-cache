#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
case "${1:-validate}" in
  validate) npm run build; npm test ;;
  local) exec npm start ;;
  docker) docker build -t genealogy-cache:local .; exec docker run --rm -it -p "${PORT:-3000}:3000" genealogy-cache:local ;;
  macos) docker build --platform linux/arm64 -t genealogy-cache:local .; exec docker run --rm -it --platform linux/arm64 -p "${PORT:-3000}:3000" genealogy-cache:local ;;
  *) echo "Usage: $0 [validate|local|docker|macos]" >&2; exit 2 ;;
esac
