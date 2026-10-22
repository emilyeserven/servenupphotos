#!/bin/bash
# Gets a Claude Code cloud session ready to run the checks, the Go tests and `pnpm shot`: JS
# dependencies, exiftool (so the EXIF tests run instead of skipping) and a warm Go build cache.
# Each step is skipped when it's already done, and the container is cached after it runs.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

pnpm install

if ! command -v exiftool >/dev/null 2>&1; then
  apt-get update -q
  apt-get install -y -q --no-install-recommends libimage-exiftool-perl
fi

# Downloads the Go modules and compiles the backend and its tests once, so the first `go test`
# takes seconds instead of about 40.
(cd apps/be-pipeline && go mod download && go build ./... && go test -count=1 -run '^$' ./...)
