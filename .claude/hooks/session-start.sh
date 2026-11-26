#!/bin/bash
# Gets a Claude Code cloud session ready to run the checks, the Go tests and `pnpm shot`: JS
# dependencies, exiftool (so the EXIF tests run instead of skipping), golangci-lint (the version
# ci.yml pins, so `golangci-lint run` finds what CI would) and a warm Go build cache.
# Each step is skipped when it's already done, and the container is cached after it runs.
#
# Claude Code runs it only when the session starts inside the repo, since that's where it reads
# .claude/settings.json. A session started in a parent folder (as project threads are, in
# /home/user) never runs it and has an empty CLAUDE_PROJECT_DIR, so the script finds the repo from
# its own path and can be run by hand: `.claude/hooks/session-start.sh`.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
echo "session-start: setting up $(pwd)" >&2

pnpm install

if ! command -v exiftool >/dev/null 2>&1; then
  apt-get update -q
  apt-get install -y -q --no-install-recommends libimage-exiftool-perl
fi

# Installs golangci-lint with its own script into /usr/local/bin, which is already on PATH, rather
# than with `go install`, which would build it from source.
if ! command -v golangci-lint >/dev/null 2>&1; then
  curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh \
    | sh -s -- -b /usr/local/bin v2.14.0
fi

# Downloads the Go modules and compiles the backend and its tests once, so the first `go test`
# takes seconds instead of about 40.
(cd apps/be-pipeline && go mod download && go build ./... && go test -count=1 -run '^$' ./...)
