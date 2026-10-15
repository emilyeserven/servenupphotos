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
pnpm dev:portfolio   # just the portfolio: http://localhost:5173/servenupphotos/
pnpm dev:docker      # just the pipeline in Docker: http://localhost:5174
pnpm dev:pipeline    # the pipeline without Docker: Go :8081 + Fastify :8080 + Vite :5173 (proxies /api → :8080)
```

`pnpm dev` opens:

| URL                                     | What                                        |
| --------------------------------------- | ------------------------------------------- |
| <http://localhost:5173/servenupphotos/> | portfolio (Vite on the host)                |
| <http://localhost:5174>                 | pipeline UI (`PIPELINE_DEV_PORT` in `.env`) |

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

### EXIF and color data

Open `/exif` in the pipeline UI (<http://localhost:5174/exif> with `pnpm dev:docker`, <http://localhost:5173/exif> with
`pnpm dev:pipeline`) to upload a JPEG and see its EXIF metadata and colors in two tabs. The photo streams from the client through the BFF
(`POST /api/exif`) to the Go backend (`POST /exif`), which buffers it to a temp file, reads its metadata with
[go-exiftool](https://github.com/barasher/go-exiftool), summarises its colors with
[go-colorful](https://github.com/lucasb-eyer/go-colorful), and deletes it. The response is
`{ file, exif, colors }`, where `colors` holds the average color, the share of the photo in each of 12 fixed hue
buckets (every 30° around the color wheel), a lightness histogram of the neutral pixels (too dark or unsaturated to
have a hue), the mean lightness and chroma, and `raw`: per-channel statistics in every color space go-colorful
supports plus hue, lightness, chroma and saturation histograms. The UI shows these in Colors and Raw color data tabs.

### Settings

Open `/settings` in the pipeline UI to enter the Cloudflare R2 and GitHub settings the pipeline uses. The Go backend saves them to `SETTINGS_FILE`: `apps/be-pipeline/data/settings.json` (git-ignored) with
`pnpm dev:be`, or `/data/settings.json` on the `pipeline-data` Docker volume. The file is readable only by its owner.

The R2 secret access key and the GitHub token are **write-only**: `GET /settings` reports only whether each is set and
its last four characters, so after saving you can replace or clear a secret but never read it back. In a
`PUT /settings/{r2,github}` body, leaving the secret out keeps it, `""` clears it, and any other value replaces it.

> **Frontend analogy:** it works like the "Change password" field on an account page. You can set a new password, but
> the site never shows you the current one. The real value exists only on the backend.

### Saving photo data to GitHub

After a photo is analyzed on `/exif`, the **Save to GitHub** card saves its sanitized EXIF as one JSON file,
`<folder>/<name>.json`, in the repository from Settings (`POST /api/photos/github` → `POST /photos/github`). Saves never
commit to the Settings branch directly. The first save creates a `photo-data/<date>-<time>` branch from it and opens an
**Add photo data** pull request; later saves add their files to that pull request for as long as it is open, so one
pull request collects every photo until you merge it. An existing file is never overwritten.

The GitHub token needs **Contents: Read and write** and **Pull requests: Read and write**.

> **Frontend analogy:** it's like a "drafts" cart. Each save drops a file in the cart (the open pull request), and
> merging the pull request is checkout. After that, the next save starts a new cart.

### Photos in Flight

`/in-flight` shows the photo data waiting in the open **Add photo data** pull request (`GET /api/photos/in-flight` →
`GET /photos/in-flight`). It finds the open pull request with that title in the repository from Settings and shows each
`.json` file the pull request adds or changes directly in the Settings folder (`apps/portfolio/src/data` when the folder
is blank), read at the pull request's head. `ALLPHOTOS.json` isn't listed as a photo: instead each photo gets a check
mark when its data is one of the entries in `ALLPHOTOS.json` at the same head (compared as JSON, so formatting and key
order don't matter). Next to each photo's JSON it shows the photo from R2: the newest `photos/<hash>-<name>.jpg`
upload whose name matches the JSON's `file` (or the JSON file's name), served from the bucket's public URL, or a
"no image" sign when there's none. The page only reads from GitHub and R2; it never changes the pull request.

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
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is served from `/servenupphotos/` (Vite `base`), and `404.html` is a copy of `index.html` so deep links work.

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
