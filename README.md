# servenupphotos

Monorepo for a photography portfolio and the local tooling that feeds it.

| App                 | Path                   | Stack                                           | Runs on                      |
| ------------------- | ---------------------- | ----------------------------------------------- | ---------------------------- |
| **portfolio**       | `apps/portfolio`       | React, TanStack Router + Query, shadcn/ui, Vite | GitHub Pages (static)        |
| **client-pipeline** | `apps/client-pipeline` | React, TanStack Router + Query, shadcn/ui, Vite | Served by `bff-pipeline`     |
| **bff-pipeline**    | `apps/bff-pipeline`    | Fastify (TypeScript)                            | Local machine / Raspberry Pi |
| **be-pipeline**     | `apps/be-pipeline`     | Go (stdlib `net/http`)                          | Local machine / Raspberry Pi |

The three `*-pipeline` apps deploy together as one tool: the browser talks only to the BFF, and the BFF talks to the Go backend.

```
browser ──► bff-pipeline (Fastify, :8080) ──► be-pipeline (Go, :8081)
              └─ serves client-pipeline build
```

## Requirements

- Node 22 (`.nvmrc`) and pnpm 10 (`corepack enable`)
- Go 1.24
- [ExifTool](https://exiftool.org/install.html), only for `pnpm dev:pipeline` (`brew install exiftool`, or
  `apt install libimage-exiftool-perl`); the Docker images include it. Without it the backend still starts, and
  `POST /exif` returns color data with `"exif": null`.
- [golangci-lint](https://golangci-lint.run/welcome/install/) v2, for linting the Go code locally
- Docker with the Compose plugin, for deploying the pipeline

## Development

```sh
pnpm install

pnpm dev             # everything: portfolio on the host + the pipeline in Docker, all hot-reloading
pnpm dev:portfolio   # just the portfolio: http://localhost:5173/
pnpm dev:docker      # just the pipeline in Docker: http://localhost:5174
pnpm photos:local    # refresh the portfolio's local photo, place and localization data (docs/local-photo-data.md)
pnpm dev:pipeline    # the pipeline without Docker: Go :8081 + Fastify :8080 + Vite :5173 (proxies /api → :8080)
pnpm shot pipeline /gallery   # screenshot a page with sample data, no backend needed (see below)
```

`pnpm dev` opens:

| URL                      | What                                        |
| ------------------------ | ------------------------------------------- |
| <http://localhost:5173/> | portfolio (Vite on the host)                |
| <http://localhost:5174>  | pipeline UI (`PIPELINE_DEV_PORT` in `.env`) |

### Pipeline in Docker with hot reload

`pnpm dev:docker` runs `docker-compose.dev.yml`, which starts each pipeline app's dev server in its own container and
uses [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) (Docker Compose 2.22 or newer) to copy your
edits into them as you save:

| App               | On save                                                |
| ----------------- | ------------------------------------------------------ |
| `client-pipeline` | Vite hot module reload in the browser                  |
| `bff-pipeline`    | `tsx watch` restarts Fastify                           |
| `be-pipeline`     | container restarts and `go run` recompiles the backend |

Changing a `package.json`, `pnpm-lock.yaml`, `go.mod` or `vite.config.ts` rebuilds the affected image automatically.
Stop with <kbd>Ctrl</kbd>+<kbd>C</kbd>; `docker compose -f docker-compose.dev.yml down` removes the containers.

> **Frontend analogy:** Compose Watch is like the file watcher behind Vite's HMR, but one level up: it watches your
> files on the host and syncs them into the container, where the app's own dev server takes it from there.

### Screenshots

`pnpm shot <portfolio|pipeline> <path>` starts the app's Vite dev server, opens the page in headless Chromium and saves
a PNG in `screenshots/` (git-ignored). The pipeline's `/api` requests are answered from sample data in
`scripts/screenshot-fixtures.mjs`, built from the committed portfolio data plus one open **Add photo data** pull
request, so no Go backend, R2 or GitHub is needed. Photos on the R2 CDN are drawn as placeholders and the map gets a
plain background. Options are listed at the top of `scripts/screenshot.mjs`: `--mobile`, `--dark`, `--full`,
`--out <dir>`, `--fixtures <file>` to change an answer, `--script <file>` to click around and take several, and
`--live` to use the real BFF instead.

> **Frontend analogy:** it's Storybook for whole pages: the real components, fed canned API responses, so a page can be
> shown in any state without the services behind it.

## Features

How each part of the pipeline and portfolio works is in [`docs/`](docs):

- [Portfolio with your own photo data](docs/local-photo-data.md): how `pnpm photos:local` and the portfolio's dev server build its local photo, place and localization data, and what each portfolio view shows
- [EXIF and color data](docs/exif-and-colors.md) (`/exif`): reading a photo's EXIF metadata and color analysis
- [Portfolio homepage](docs/portfolio-homepage.md) (`/` on the portfolio): the ways to explore, over photos picked on Site Spotlight
- [Portfolio Map](docs/portfolio-map.md) (`/map` on the portfolio): photo markers, groups of photos, and jumping to all photos or an area
- [Photo, album and tag data](docs/data-model.md): the photo, album and tag JSON files and how they refer to each other
- [Settings](docs/settings.md) (`/settings`): the R2 and GitHub settings and their write-only secrets
- [Update Data](docs/update-data.md) (`/update-data`): bulk changes to the photo JSON (image base URL, missing fields)
- [Publish](docs/publish.md): the publish fields, the `/instagram` calendar and `/site-spotlight`
- [Saving photo data to GitHub](docs/saving-to-github.md): saving a photo's JSON to the Add photo data pull request, uploading to R2, resized versions and the Square Thumbnail
- [Bulk Upload](docs/bulk-upload.md) (`/bulk-upload`): adding many photos to the batch at once, with default titles and Square Thumbnails
- [Photos in Flight](docs/photos-in-flight.md) (`/in-flight`): the open pull request's photos, removing and editing them
- [Gallery](docs/gallery.md) (`/gallery`): photos already in the portfolio, editing them and adding albums and tags
- [Combined data store](docs/combined-data-store.md): how `ALLPHOTOS.json`, `ALLALBUMS.json` and `ALLTAGS.json` are read once and shared
- [Albums and Tags](docs/albums-and-tags.md) (`/albums` and `/tags`): making albums and tags, parent albums, album and tag pages
- [Places and Localizations](docs/places-and-localizations.md) (`/places` and `/localizations`): places a photo was taken at and how it relates to them, and the local script, pronunciation and romanization of countries, cities and places
- [Explore Bucket](docs/explore-bucket.md) (`/bucket`): every image in R2, and making JSON for an original
- [Manage Sizes](docs/manage-sizes.md) (`/sizes`): making and remaking resized versions
- [Sidebar](docs/sidebar.md): the pipeline's navigation, and collapsing it to icons

## Checks (same as CI)

```sh
pnpm lint        # oxlint
pnpm fmt:check   # oxfmt --check   (pnpm fmt to write)
pnpm typecheck   # tsc --noEmit in each TS app
pnpm fallow      # dead code, duplication, complexity
pnpm check       # all of the above

cd apps/be-pipeline && golangci-lint run && go test ./...   # golangci-lint also checks gofmt/goimports
```

## Deploying

### Portfolio → GitHub Pages

`.github/workflows/deploy-portfolio.yml` builds `apps/portfolio` on every push to `main` and deploys it.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**, and **Settings → Pages → Custom domain: `servenupphotos.net`** (with **Enforce HTTPS** on once the certificate is issued).
Actions deploys ignore a `CNAME` file, so the domain lives only in that setting.
The site is served from the domain root (Vite `base: "/"`), and `404.html` is a copy of `index.html` so deep links work.

### Pipeline → local machine or Raspberry Pi

The pipeline runs as two containers:

| Service        | Port | Exposed?                   | Role                                         |
| -------------- | ---- | -------------------------- | -------------------------------------------- |
| `bff-pipeline` | 8080 | yes (`PIPELINE_PORT`)      | Serves the `client-pipeline` UI and `/api/*` |
| `be-pipeline`  | 8081 | no (internal network only) | Go backend                                   |

> **Frontend analogy:** `docker compose up` is like `pnpm dev:pipeline`, but each app runs in its own
> container instead of a terminal tab. The containers restart on their own after a crash or reboot.

#### Local machine (macOS / Linux / Windows)

1. Install [Docker Desktop](https://docs.docker.com/desktop/), or Docker Engine plus the Compose plugin on Linux.
2. From the repo root:

   ```sh
   cp .env.example .env            # optional: change PIPELINE_PORT
   docker compose up -d --build
   ```

3. Open <http://localhost:8080>. The status page should show both the BFF and the backend as `ok`.

This runs the production builds, so code changes need another `docker compose up -d --build`. While developing, use
`pnpm dev:docker` instead (see [Pipeline in Docker with hot reload](#pipeline-in-docker-with-hot-reload)).

#### Raspberry Pi

Requires a Raspberry Pi 3, 4 or 5 running **Raspberry Pi OS 64-bit** (arm64). The images are built on the Pi itself.

1. Install Docker ([Debian install guide](https://docs.docker.com/engine/install/debian/)), and let your user run it without `sudo` ([post-install steps](https://docs.docker.com/engine/install/linux-postinstall/)):

   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out and back in afterwards
   sudo systemctl enable docker    # start Docker on boot
   ```

2. Clone the repo and start the pipeline:

   ```sh
   git clone https://github.com/emilyeserven/servenupphotos.git
   cd servenupphotos
   cp .env.example .env
   docker compose up -d --build
   ```

   The first build on a Pi takes a few minutes; later builds reuse cached layers.

3. Open `http://<pi-hostname>.local:8080` (e.g. `http://raspberrypi.local:8080`) from any device on the same network.

Both services use `restart: unless-stopped`, so with Docker enabled at boot the pipeline comes back up after the Pi restarts.

#### Day-to-day commands

```sh
docker compose ps                          # what's running
docker compose logs -f                     # follow logs (add bff-pipeline or be-pipeline to filter)
git pull && docker compose up -d --build   # update to the latest code
docker compose down                        # stop and remove the containers
```

#### Without Docker

You can also run the built apps directly with Node 22, pnpm and Go installed:

```sh
pnpm install --frozen-lockfile
pnpm --filter @servenup/client-pipeline --filter @servenup/bff-pipeline build
(cd apps/be-pipeline && go build -o bin/api ./cmd/api)

apps/be-pipeline/bin/api &              # Go backend on :8081
node apps/bff-pipeline/dist/index.js    # UI + API on :8080 (serves apps/client-pipeline/dist)
```

Environment variables (all optional): `PORT` (BFF port, default `8080`), `API_URL` (Go backend URL, default
`http://localhost:8081`), `CLIENT_DIST` (path to the client build). The Go backend reads `PORT` (default `8081`).

## Roadmap

- [ ] Image optimization and cropping (be-pipeline)
- [ ] Upload to Cloudflare R2 (`apps/be-pipeline/internal/storage`; see the `R2_*` vars in `.env.example`)
- [ ] Generate gallery JSON into `apps/portfolio/src/data/` and render it in the portfolio
