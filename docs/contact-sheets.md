# Contact sheets

The prompts that link many photos can link a few **contact sheets** instead: each sheet is one JPEG with up to 30
of the prompt's photos as numbered tiles, labeled with the tile number and the name the prompt calls the photo by.
An LLM looks through a handful of sheets instead of opening dozens or hundreds of links one by one.

Pages with **Make contact sheets**: [Autogroup](compare-groups.md#autogroup), [Bulk Tagging](update-data.md#bulk-tagging),
[Genre Suggestions](update-data.md#genre-suggestions) and [Bulk Places](update-data.md#bulk-places).

## Using it

1. Pick or choose the photos as usual.
2. Press **Make contact sheets** (next to the copy button). It's optional: without sheets, the prompt is the same as
   before.
3. Once it says how many sheets are ready, copy the prompt. It now starts with a list of the sheets
   (`Contact sheet 2 (tiles 31 to 60): https://…`), asks the LLM to look through them first, and adds each photo's
   tile to its line: `Photo "20161216_092741" (tile 12 on contact sheet 1): https://…-small.webp`. Every photo keeps
   its own link, which the prompt says to open only for a closer look, such as to tell two similar photos apart.

The sheets belong to the photos they were made for. Picking other photos (or changing Autogroup's choices) drops
them, so the tile numbers in a prompt always match its sheets; make them again for the new photos. A photo that
couldn't be read is drawn as a gray tile, and listed under the button, so the numbers after it still match.

A full sheet is 1496 × 1398 pixels: 6 columns and 5 rows of 240-pixel tiles. That stays under the 1568 pixels Claude
scales an image's long edge down to, so the labels stay readable, and costs about 2,800 image tokens for 30 photos
([Claude vision docs](https://docs.claude.com/en/docs/build-with-claude/vision)), about what 4 or 5 Small versions
cost on their own.

> **Frontend analogy:** it's a sprite sheet. One request for many small images beats many separate requests, and
> each tile's number is its offset into the sheet.

## How it's made

`POST /api/photos/bucket/contact-sheets` takes `{ photos: [{ label, url }] }` in the prompt's order and answers
`{ sheets: [{ url, first, last }], missing: [label], expiryProblem }`.

- The backend (`internal/httpapi/contactsheets.go`) reads each photo's Small version from the
  [offline copy](offline-mode.md), downloading it from R2 first when it isn't kept yet; any other link is read over
  the internet. It reads 8 at a time, one sheet's photos at a time, so only 30 are in memory at once.
- `internal/contactsheet` draws the sheet in the Go fonts that ship with `golang.org/x/image`, numbers in bold yellow
  and names in white, shortened with "…" when they don't fit.
- `storage.UploadContactSheets` puts the sheets in R2 at `contact-sheets/<time>-<random>/sheet-01.jpg`, a new folder
  every time, so an old link never shows a newer sheet. They need the public URL in Settings, like every other link
  a prompt uses: the pipeline is reached over Tailscale, so an LLM can't open anything the pipeline serves itself.
- It can take a few minutes for hundreds of photos, so the BFF waits up to 5 minutes for it
  ([BFF timeouts](bff-timeouts.md)).

The prompt text is in `lib/contact-sheets.ts`; the button and the hook that keeps the sheets with their photos are in
`components/contact-sheets-button.tsx`.

## Deleting them after a day

Everything in `contact-sheets/` is deleted by an R2 **object lifecycle rule**, not by the pipeline
([R2 lifecycle docs](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)). Rules count in whole days, so
a sheet lasts at least a day, and Cloudflare may delete it a little after that.

The first time sheets are made, the pipeline adds the rule itself through the S3 API
(`storage.EnsureContactSheetExpiry`): it reads the bucket's lifecycle rules and, unless one already deletes
`contact-sheets/` after 1 day, adds `delete-contact-sheets` next to the others. Once that works it doesn't check again
until the backend restarts.

Changing a bucket's settings needs an R2 API token with **Admin Read & Write**. With an **Object Read & Write**
token the sheets are still made, and a warning under the button says the rule couldn't be added. Add it by hand once:

1. In the Cloudflare dashboard, open **R2** → the bucket → **Settings** → **Object lifecycle rules** → **Add rule**.
2. Name it (say, "Delete contact sheets"), choose **Prefix** and enter `contact-sheets/`.
3. Under **Delete uploaded objects**, set it to **1 day** after upload, and save.

The pipeline then finds that rule and stops warning.

> **Frontend analogy:** a lifecycle rule is a `Cache-Control: max-age` that actually deletes the file. Like a
> preview deploy, the sheet's link is public just long enough for the LLM to look, then it's gone.
