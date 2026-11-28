# Dependency audit

How the repo checks its packages for known security advisories: the `Audit` workflow (`.github/workflows/audit.yml`) runs `pnpm audit --prod` and Go's `govulncheck` when the lockfile or `go.mod` changes, and every Monday.

## Why it's separate from Dependabot

Dependabot (`.github/dependabot.yml`) opens one pull request a week with the minor and patch updates of the packages listed in each `package.json` and `go.mod`. A package that only comes in through another one, such as `seroval` through TanStack Router, isn't listed, so its lockfile version stays put even when the parent allows a fixed one. The audit catches that. To fix it, refresh just that package in the lockfile:

```sh
pnpm update -r --depth Infinity <package>
```

> **Frontend analogy:** `govulncheck` is `pnpm audit` for the Go backend, with one difference: it only reports an advisory when the backend actually calls the vulnerable function, so it fails less often for code that's installed but never run.

## What it checks

- `pnpm audit --prod` checks only the packages the apps ship. Dev-only tools, such as the shadcn CLI, run on a laptop and are left out.
- `govulncheck` checks the Go backend's modules and the Go standard library at the version the server runs: the newest 1.27 release, which `apps/be-pipeline/Dockerfile` builds from `golang:1.27-alpine`. When the Dockerfile moves to a new Go version, change `go-version` in `audit.yml` with it. `go.mod`'s `go 1.26.0` is only the oldest version the code builds with, and 1.26.0 has since had security fixes, so scanning at it would report advisories the server doesn't have.

It runs on pull requests only when they change `pnpm-lock.yaml`, `go.mod` or `go.sum`, so a new advisory published on a Tuesday doesn't fail an unrelated pull request; the weekly run reports it instead. Run it by hand from the Actions tab with **Run workflow**.
