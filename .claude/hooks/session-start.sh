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

# Installs the golangci-lint version ci.yml pins into /usr/local/bin, which is already on PATH. A
# container can come with an older one already there, which fails on code for a newer Go ("the Go
# language version used to build golangci-lint is lower than the targeted Go version"), so the
# version is compared, not just whether it's installed. Tries the release download first and falls
# back to `go install` (slower, since it builds from source) when GitHub's release files can't be
# reached. Run from apps/be-pipeline so the build uses the Go version go.mod names.
lint_version="$(sed -n 's/^ *version: v\([0-9.]*\)$/\1/p' .github/workflows/ci.yml | head -1)"
if [ "$(golangci-lint version --short 2>/dev/null || true)" != "$lint_version" ]; then
  echo "session-start: installing golangci-lint $lint_version" >&2
  curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh \
    | sh -s -- -b /usr/local/bin "v$lint_version" \
    || (cd apps/be-pipeline \
      && GOBIN=/usr/local/bin go install "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v$lint_version")
fi

# Downloads the Go modules and compiles the backend and its tests once, so the first `go test`
# takes seconds instead of about 40.
(cd apps/be-pipeline && go mod download && go build ./... && go test -count=1 -run '^$' ./...)
