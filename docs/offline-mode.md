# Offline mode

The pipeline can be used without the internet to look through the [Gallery](gallery.md), the
[Undecided](photos-in-flight.md#undecided) queue and [drafts](drafts.md). Two things make that work:

- **The photo data** comes from the backend's [local copy](pending-changes.md#the-local-copy) of GitHub
  (`github-cache.json`), which it already answers from when GitHub can't be reached at start-up.
- **The thumbnails** come from the **offline copy**: every Square Thumbnail and Thumbnail Preview, kept on disk in
  `offline/thumbnails/` next to the settings file (`/data/offline` in Docker, on the `pipeline-data` volume), with
  `offline/images.json` saying where each photo's image was found in R2 the last time R2 could be searched.

## Where thumbnails come from

The Gallery, Photos in Flight, its Undecided queue, the drafts lists and the album and tag pages (their photos, the
**Reorder** tiles and the [Layout and covers](album-layouts.md) editor and its photo pickers) show each photo's Square Thumbnail and
Thumbnail Preview through `GET /api/thumbnails?url=<its R2 URL>` (→ `GET /thumbnails`) instead of straight from the
CDN. The backend serves it from the offline copy, or downloads it from R2 first (with the R2 settings, like other
reads) when the copy doesn't have it yet. Only Square Thumbnails and Thumbnail Previews under `photos/` are kept; any
other URL is refused with a 400. The file name keeps the URL's crop mark (`?crop=…`), so a Square Thumbnail remade from
a new crop is downloaded again rather than shown stale.

> **Frontend analogy:** it's a service worker's cache-first strategy, run on the backend: look in the cache, else
> fetch from the network and put it in the cache. The crop mark works like a content hash in an asset's file name.

## Fetching new ones on start

Each time the backend starts (such as `docker compose up`), it reads the Gallery's and Photos in Flight's photos in
the background, the same reads those pages make, looks their images up in R2, and downloads every Square Thumbnail and
Thumbnail Preview the offline copy is missing, four at a time. The log says how many it downloaded
(`offline copy: thumbnails ready`). Ones already on disk are never downloaded again. When GitHub or R2 can't be
reached, it logs why and downloads nothing; the pipeline starts as usual. Photos uploaded after that are kept the first
time a page shows them.

> **ELI5:** every morning the pipeline makes a photo album of small pictures of all your photos, so you can still
> flip through it when the internet is down.

## When R2 can't be reached

Pages look for each photo's image in R2 (`images` in `GET /photos/published` and `GET /photos/in-flight`). When R2
can't be searched, they get the images found the last time it could be from `offline/images.json`, with
`images.offline: true`, and the Gallery and Photos in Flight show an **Offline** notice above their filters. Tiles and
**Edit** links work as usual for those photos. Saves still wait for [Commit](pending-changes.md), and Commit, uploads
and full-size images still need the internet.

Making albums and tags, and saving an album's parent, photo order, covers and layout, work offline too: they're
saved as changes waiting for Commit against the local copy, and Commit sends them once GitHub can be reached.

Deleting the `offline` folder only costs the next start a full download of the thumbnails.

## In-flight work in the browser

The backend keeps the changes waiting for Commit in `pending-changes.json`, which survives a restart. Once the
pipeline has been offline (the browser reported `offline`, or a page got the **Offline** notice), the app also keeps a
copy of all the in-flight work in `localStorage` (`pipeline-in-flight-backup`): the backend's changes, read from
`GET /api/photos/pending` (→ `GET /photos/pending`, which reads nothing from GitHub), and the browser-only
[local edits](combined-data-store.md#local-edits). It copies them when the app starts, after every save and edit, and
after a Commit. A copy with changes is never replaced by an empty one, so a backend that lost its volume can't wipe it;
once a Commit leaves nothing waiting while online, the copy is dropped and the app stops keeping one until the next
time it's offline. **Discard** drops it too.

> **Frontend analogy:** it's a `persist`ed Zustand store mirroring a server resource, like an offline-first app keeping
> its outbox in IndexedDB until the server confirms it.

### Export and Import

The sync button's panel has an **In-flight work** row:

- **Export** downloads everything waiting for Commit and the browser-only edits as one JSON file named with the time,
  such as `in-flight-work-2026-10-30T06-44-08Z.json`: `{ version, repo, exported, files: [{ path, data | deleted,
  saved }], localEdits }`.
- **Import** loads such a file back, after asking (`POST /api/photos/pending` → `POST /photos/pending` with the file).
  Each file becomes a change waiting for Commit, as a save would make it: formatted like the app formats data files,
  replacing any change waiting for the same file, and dropped when the pull request's head already has it. A file
  outside the data folders, a combined list such as `ALLPHOTOS.json`, data that isn't JSON, a backup of another
  repository or of a newer version is refused, and then nothing is kept. Its browser-only edits are added over any of
  the same photos.
- **Kept in this browser while offline** shows the browser's copy, when it has changes, with **Restore** (the same as
  Import) and **Download**.
