# Portfolio with your own photo data

`pnpm dev` and `pnpm dev:docker` first run `pnpm photos:local`, which writes `ALLPHOTOS.local.json`,
`PLACES.local.json`, `LOCALIZATIONS.local.json`, `ALLALBUMS.local.json`, `ALLTAGS.local.json` and
`METAINFO.local.json` (git-ignored) in `apps/portfolio/src/data/photos`, `places`, `localizations`, `albums`, `tags` and
`metainfo`. The album, tag and [metadata group](metadata-groups.md) files are what the
[filters](portfolio-filters.md) list. It takes them from the first of these that answers:

1. **The photo pipeline**, when it's running locally (`PIPELINE_URL`, or else `http://localhost:8080`, then
   `http://localhost:5174`): the combined files at the open **Add photo data** pull request's head (or the base
   branch's, when none is open but [changes are waiting for Commit](pending-changes.md)), with the photo, place,
   localization, album, tag and metadata group files in flight put over them (matched by `file` for photos and `id` for the rest) and
   removed ones taken out. So saves not committed with **Commit** yet show too. Skipped with no pull request open and
   nothing waiting.
2. **GitHub**: the combined files from the open pull request on the `origin` repository. Set `GITHUB_TOKEN` for a
   private repository, or if GitHub's limit of 60 unauthenticated requests an hour runs out.
3. **The data folders**: every other JSON file in each folder, as one array sorted by file name, the same way the
   **Combine photo data** workflow builds the combined files, without [drafts](drafts.md).

While the portfolio's dev server runs, each page load (at most every 10 seconds) runs it again with
`--pipeline-only`: it asks only the pipeline, and leaves the files alone when the pipeline isn't running. A file is
only written when it changed, so saving a place, a localization or a photo's places in the pipeline and then reloading
the portfolio shows them in the Table, Map, Timeline, Grid (with **Show info**) and photo viewer.

> **Frontend analogy:** the dev server's refresh is like a loader that refetches on navigation, except it rewrites the
> JSON the bundle imports, and Vite's file watcher does the "rerender".

While the file has at least one photo, the portfolio's Timeline, Map and Grid show those photos instead of the
committed `apps/portfolio/src/data/photos/ALLPHOTOS.json` (the Map leaves out photos without a GPS position, the Grid photos without resized versions, and photos without a
`createDate` are left out everywhere); with no photos, or no file, they fall back to the committed
file, and the Grid shows its placeholder when that has no photos with resized versions either. The Grid loads each photo's resized versions from R2 through `srcset`, newest photo first, with the
blurred `preview` behind each one until it loads (the `thumbnailpreview` behind a Square Thumbnail, falling back to the
`preview` when it won't load). The real image fades in over it once it loads; a Square Thumbnail that won't load falls
back to the middle of the resized versions, and when nothing loads the tile stays blurred instead of showing a broken
image. Run `pnpm photos:local` again to pick up new photos; the running
portfolio reloads the file on its own.

> **Frontend analogy:** it's a local mock of the API response: the same JSON CI publishes, copied to your machine so
> the portfolio can render real data before the pull request merges.
