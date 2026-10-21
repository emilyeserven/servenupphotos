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
pnpm photos:local    # refresh the portfolio's local ALLPHOTOS.local.json (see below)
pnpm dev:pipeline    # the pipeline without Docker: Go :8081 + Fastify :8080 + Vite :5173 (proxies /api → :8080)
```

`pnpm dev` opens:

| URL                                     | What                                        |
| --------------------------------------- | ------------------------------------------- |
| <http://localhost:5173/servenupphotos/> | portfolio (Vite on the host)                |
| <http://localhost:5174>                 | pipeline UI (`PIPELINE_DEV_PORT` in `.env`) |

### Portfolio with your own photo data

`pnpm dev` and `pnpm dev:docker` first run `pnpm photos:local`, which writes
`apps/portfolio/src/data/ALLPHOTOS.local.json` (git-ignored). It copies `ALLPHOTOS.json` from the open **Add photo
data** pull request on the `origin` GitHub repository, so the portfolio shows the photos in flight. With no such pull
request, or when GitHub can't be reached (it says why), it combines the photo JSON files in `apps/portfolio/src/data`
instead, the same way the **Combine photo data** workflow builds `ALLPHOTOS.json`: every other JSON file in the folder
except `dummy.json`, as one array sorted by file name. Set `GITHUB_TOKEN` for a private repository, or if GitHub's
limit of 60 unauthenticated requests an hour runs out.

While the file has at least one photo, the portfolio's Timeline, Map and Grid show those photos instead of the dummy
data (the Map leaves out photos without a GPS position, the Grid photos without resized versions, and photos without a
`createDate` are left out everywhere); with no photos, or no file, they fall back to `dummy.json`, and the Grid shows
its placeholder. The Grid loads each photo's resized versions from R2 through `srcset`, newest photo first, with the
blurred `preview` behind each one until it loads. Run `pnpm photos:local` again to pick up new photos; the running
portfolio reloads the file on its own.

> **Frontend analogy:** it's a local mock of the API response: the same JSON CI publishes, copied to your machine so
> the portfolio can render real data before the pull request merges.

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

The sanitized EXIF has the original photo's `width` and `height` in pixels (as it's shown, so swapped for a photo
whose EXIF orientation turns it on its side), and an `images` object whose `full` is the photo's public R2 URL and `key`
its object key, and whose `xlarge`, `large`, `medium`, `small`, `xsmall` and `preview` are the public URLs of its resized versions
and `thumbnail` the public URL of its Square Thumbnail. The
`images` links are `null` until you
upload the photo with **Upload to R2**, so upload before saving if the JSON should link to the photo. The
**JSON to Upload** tab shows exactly what Save to GitHub will write, and picks up the URL as soon as the upload finishes.

Once a photo is analyzed, the page first looks for it in the saved photo data on GitHub (`POST /api/photos/all-photos/check`
→ `POST /photos/all-photos/check`): `ALLPHOTOS.json` on the Settings branch, and each photo JSON file the open **Add photo
data** pull request adds or changes. The pull request's files are read directly, not its `ALLPHOTOS.json`, because CI
rebuilds that after every push and may not have caught up yet. An entry with the same `file`, `gpsPosition` and `createDate` (exactly equal, with `null` matching only `null`) means the
photo is already in the portfolio: the page shows that entry and hides **Upload to R2** and **Save to GitHub**, since
editing a saved photo isn't supported yet. If the check can't run (GitHub isn't set up, or the file can't be read), the
page says so and still offers both.

Only JPEG photos can be uploaded. Along with the original `photos/<hash>-<name>.jpg`, **Upload to R2** puts six WEBP
versions next to it, scaled down to fit their longest edge (width or height) and keeping their proportions:
`photos/<hash>-<name>-xlarge.webp` (2500px), `-large.webp` (1800px), `-medium.webp` (1200px), `-small.webp` (500px) and
`-xsmall.webp` (250px), sized with high-density (Retina) screens in mind, plus `-preview.webp` (40px), a low-res
placeholder of a few hundred bytes to show blurred while a real version loads. A photo already smaller than
a version keeps its size. The Go backend turns the photo upright from its EXIF orientation, resizes it with
[imaging](https://github.com/disintegration/imaging) and encodes it at WEBP quality 95 (60 for the preview, which is shown blurred anyway; libwebp method 6, its slowest and smallest) with
[gen2brain/webp](https://github.com/gen2brain/webp) (libwebp compiled to pure Go, so the image needs no C library). The
versions carry no metadata.

The **Resized versions** card above **Upload to R2** has a button per version, plus **Original**, that opens it in a
full-window lightbox pixel for pixel on the screen (on a Retina screen that's half its CSS size, so the browser doesn't
stretch it and blur it), with a warning when the window is too small and it had to be scaled down. The preview is the exception: it's stretched to fill the window and smoothed with
`filter: blur(12px)`, as a page would show it while the real image loads, and the lightbox names that filter. For a version it
also says how much smaller the WEBP is than the same version saved as a JPEG at the original's own quality, estimated
from its quantization tables (the backend sends `X-Jpeg-Bytes` and `X-Jpeg-Quality` headers). That JPEG is only a
comparison: versions are always made straight from the original's pixels, never from a re-saved JPEG.
Each version is made exactly as an upload would make it (`POST /api/photos/versions/{xlarge,large,medium,small,xsmall,preview}` → `POST /photos/versions/{version}`, which
answers with the WEBP), so its quality can be checked before anything is uploaded. Removing a photo from Photos in Flight
deletes its versions and Square Thumbnail from R2 along with the original.

The **Square Thumbnail** card picks the part of the photo used where every photo gets the same square tile, such as the
portfolio's Grid. It starts as the largest square in the middle of the photo (what `object-fit: cover` would show); drag
the square to move it, drag a corner to resize it, or focus it and use the arrow keys (Shift for bigger steps) and `+`
and `-`. A preview next to it shows the Square Thumbnail as it will look. **Upload to R2** sends the square as `cropX`, `cropY`
and `cropSize` form fields before the photo (in pixels of the photo turned upright, as the browser shows it), and the
backend cuts it out and scales it, up or down, to exactly 500 × 500 px, `photos/<hash>-<name>-thumbnail.webp` at WEBP
quality 95, with the square saved in its `crop` object metadata (`x,y,size`) so remaking it on Manage Sizes keeps it.
Without those fields it uses the middle square. The square can't change once the photo is uploaded. The
Grid shows a photo's `thumbnail` when it has one, and the middle of its resized versions for photos saved before
thumbnails existed.

> **Frontend analogy:** it's `srcset` prepared ahead of time: one source image, five sizes for the portfolio to pick
> from, plus a tiny `preview` for the blur-up trick (show it stretched with `filter: blur()` as the `<img>`'s background
> until the real image loads).

Before uploading, **Upload to R2** looks in the bucket for a different photo saved under the same name
(`photos/<hash>-<name>.jpg` with another hash), since Photos in Flight matches photos by name. If there is one, it shows
that photo and asks for a new name, or you can keep the name anyway (a `sameName=keep` form field before the photo). When
Cloudflare rejects a request, the card also shows Cloudflare's own answer (HTTP status, error code and message) under
the plain-language reason.

The GitHub token needs **Contents: Read and write** and **Pull requests: Read and write**. **Actions: Read-only** is
optional: with it, Photos in Flight can tell when CI has rebuilt `ALLPHOTOS.json` after a removal.

> **Frontend analogy:** it's like a "drafts" cart. Each save drops a file in the cart (the open pull request), and
> merging the pull request is checkout. After that, the next save starts a new cart.

### Photos in Flight

`/in-flight` shows the photo data waiting in the open **Add photo data** pull request (`GET /api/photos/in-flight` →
`GET /photos/in-flight`). It finds the open pull request with that title in the repository from Settings and shows each
`.json` file the pull request adds or changes directly in the Settings folder (`apps/portfolio/src/data` when the folder
is blank), read at the pull request's head. `ALLPHOTOS.json` isn't listed as a photo: instead each photo gets a check
mark when its data is one of the entries in `ALLPHOTOS.json` at the same head (compared as JSON, so formatting and key
order don't matter). Next to each photo's JSON it shows the photo from R2: the object at the JSON's `images.key` (or `images.full` URL)
when it has one, or else the newest `photos/<hash>-<name>.jpg` upload whose name matches the JSON's `file` (or the JSON
file's name), or a "no image" sign when there's none. Under the photo is its Square Thumbnail: the JSON's
`images.thumbnail`, or else the `-thumbnail.webp` next to the photo in R2, with a placeholder when R2 doesn't have one
(as for photos uploaded before Square Thumbnails). Clicking it opens it at its full 500 × 500.

Each file the pull request adds has a **Remove** button (`DELETE /api/photos/in-flight?path=…`). After asking, it
deletes the JSON from the pull request's branch and the image the page shows from R2 (skipped when R2 has none). Files the
pull request only modifies can't be removed, since that would delete them from the portfolio on merge. The removal's
commit starts the **Combine photo data** workflow. The page polls `GET /api/photos/in-flight/ci` (that workflow's newest
run on the pull request's branch, or "waiting" when someone pushed after it; pass `?sha=…` for one commit's run instead)
and, while CI is rebuilding `ALLPHOTOS.json`, shows a spinner beside it and spins each file's "Not in ALLPHOTOS.json"
mark. When the run finishes it refreshes. Without **Actions: Read-only** on the token it refreshes about 30 seconds
after a removal instead.

### Explore Bucket

`/bucket` shows every image in the R2 bucket from Settings (`GET /api/photos/bucket` → `GET /photos/bucket`), newest
first, under any prefix: objects ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` or `.avif`. Each tile shows the image
from the bucket's public URL with its key, size and upload time, and links to the full image. It needs the R2 keys,
bucket and public URL in Settings, and only reads from R2. An image whose photo data is still in the open **Add photo
data** pull request is faded with a pull request badge, and so are that photo's resized versions.

Each original is shown as a stack, with blank squares behind it standing for its resized copies (keys
`<original stem>-<version>.webp`). Clicking the stack puts the copies right after the original in the grid, largest
first, each labelled with its size (for example "Large · 1800px"); clicking it again collapses them. The key under a
tile links to the image. A resized copy whose original isn't in the bucket shows on its own, still labelled.

A photo already in `ALLPHOTOS.json` (on the base branch, or in the pull request's copy) gets a book badge
(`GET /api/photos/all-photos` → `GET /photos/all-photos` reads it from the base branch). An entry matches by its saved
`images.key`, then its `images.full` URL, then by the name stem in the original's key. An original JPEG that is neither
in flight nor in `ALLPHOTOS.json` gets a **Generate JSON** button, which opens a modal that reads the original
from R2 (`POST /api/photos/bucket/exif` with `{ "key" }` → `POST /photos/bucket/exif`) through the same EXIF and color
analysis as `POST /exif`. The JSON gets the original's URL and key and the URLs of the resized copies in the bucket, and
its `file` is the name kept in the key (`photos/<hash>-dsc0001.jpg` gives `dsc0001.jpg`). After the same
`ALLPHOTOS.json` check as Add Photo, **Save to GitHub** asks for the JSON file name and adds it to the photo data pull
request. The button only shows once both checks have run, so it needs the GitHub settings too.

### Manage Sizes

`/sizes` lists every original the pipeline uploaded (`photos/<hash>-<name>.jpg`) in a table, one row per photo with
its X-Small version as a thumbnail, and one column per resized version plus one for the Square Thumbnail. A size that's already in the bucket has a
circle-arrows button that remakes it; a size that isn't (for example, one added after the photo was uploaded) has a
lightning bolt button that makes it. Hovering a row shows a circle-arrows button next to the photo's name that remakes
every size. Clicking a thumbnail opens the Medium (1200px) version, or the original when there's no Medium yet, in
a full-window view. A table too wide for the window scrolls sideways. Each button sends `POST /api/photos/bucket/versions` → `POST /photos/bucket/versions` with the original's
`key` and the `versions` to make (every version and the Square Thumbnail when left out); the backend downloads the
original from R2, resizes it exactly as an upload does, and uploads the versions over whatever was at their keys. The
Square Thumbnail is cut from the crop saved with the one already in R2 (read with a `HEAD` of it), so remaking it keeps
the square picked on the Photo page; making one that isn't there yet, for a photo uploaded before Square Thumbnails
existed, uses the middle of the photo. It doesn't change the photo's JSON.

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
