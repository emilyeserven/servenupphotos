# Photos in Flight

`/in-flight` shows the photo data waiting in the open **Add photo data** pull request (`GET /api/photos/in-flight` →
`GET /photos/in-flight`). It finds the open pull request with that title in the repository from Settings and shows each
`.json` file the pull request adds or changes directly in the photos folder (`apps/portfolio/src/data/photos` when the
Settings data folder is blank), read at the pull request's head. `ALLPHOTOS.json` isn't listed as a photo: instead each photo gets a check
mark when its data is one of the entries in `ALLPHOTOS.json` at the pull request's head, as the
[combined data store](combined-data-store.md) has it (compared as JSON, so formatting and key order don't matter). Next to each photo's JSON it shows the photo from R2: the object at the JSON's `images.key` (or `images.full` URL)
when it has one, or else the newest `photos/<hash>-<name>.jpg` upload whose name matches the JSON's `file` (or the JSON
file's name), or a "no image" sign when there's none. Under the photo is its Square Thumbnail: the JSON's
`images.thumbnail`, or else the `-thumbnail.webp` next to the photo in R2, with a placeholder when R2 doesn't have one
(as for photos uploaded before Square Thumbnails). Its Thumbnail Preview (`images.thumbnailpreview`, or the
`-thumbnailpreview.webp` next to the photo) shows blurred behind it while it loads. Clicking it opens it at its full 500 × 500.

Each file the pull request adds has a **Remove** button (`DELETE /api/photos/in-flight?path=…`). After asking, it
deletes the JSON from the pull request's branch and the image the page shows from R2 (skipped when R2 has none). Files the
pull request only modifies can't be removed, since that would delete them from the portfolio on merge. Like every other
save, the removal doesn't change `ALLPHOTOS.json`; see
[Committing the combined files](combined-data-store.md#committing-the-combined-files). The **Synced** row says whether
the combined files have the pull request's changes, with a **Commit** button when they don't, and each file they don't
have yet is marked "Not synced to ALLPHOTOS.json yet".

Each photo whose JSON was read and whose image is in R2 has an **Edit** button, which opens it on the Photo page in
edit mode (`/exif?edit=<path>`) to change the square its Square Thumbnail is cut from. The crop editor starts from the
crop saved with the thumbnail in R2 (`GET /api/photos/bucket/thumbnail-crop?key=…`, else the JSON's
`images.thumbnailcrop`, else the middle), on
the original photo from R2. **Save changes** (at the top right, to the right of the sync button) first remakes the thumbnail and its Thumbnail Preview from the new
square (`POST /api/photos/bucket/versions` with `versions: ["thumbnail", "thumbnailpreview"]` and a `crop`, which
replaces the saved one), then writes the JSON over the file on the pull request's branch (`PUT /api/photos/in-flight`
with the `path` and new `data`; files the pull request removes can't be edited, and photos already in the portfolio are
saved into the pull request, as the [Gallery](gallery.md) describes). Both keep their R2 keys, so
the JSON's `images.thumbnail` and `images.thumbnailpreview` get a `?crop=x,y,size` query: a new URL that browsers and
Cloudflare's cache fetch afresh instead of showing the old square (R2 ignores the query), and `images.thumbnailcrop` the
new square. Saving any other change to a file without `images.thumbnailcrop` adds it too. The commit starts the **Combine photo data** workflow, which the page
follows the same way.

Under the photos it lists the album and tag files the pull request adds or changes, each with its JSON and a check mark
when it's an entry of `ALLALBUMS.json` or `ALLTAGS.json` at the same head, and the pull request summary counts them.
