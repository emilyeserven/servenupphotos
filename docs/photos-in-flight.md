# Photos in Flight

`/in-flight` shows the photo data waiting in the open **Add photo data** pull request and the
[changes waiting for Commit](pending-changes.md) (`GET /api/photos/in-flight` →
`GET /photos/in-flight`). It finds the open pull request with that title in the repository from Settings and shows each
`.json` file that it or a change waiting for Commit adds or changes directly in the photos folder
(`apps/portfolio/src/data/photos` when the Settings data folder is blank), as the next Commit will have it. Photos
without a title (a `title` that's null or blank) come first, so they're easy to find and name; the sync button's panel
has **Next untitled photo** to open them one after another (see
[Committing the combined files](combined-data-store.md#committing-the-combined-files)). An untitled photo is a
[draft](drafts.md), marked **Draft, not on the portfolio** instead of the `ALLPHOTOS.json` check mark. A file with
a change waiting for Commit is marked **Waiting for Commit** and has no GitHub link yet. With no pull request open, the
summary says how many files are waiting, with **Commit**, which opens one. **Refresh** asks GitHub again
(`?refresh=1`), rather than using the backend's read from when it started, so a merge made on GitHub shows at once. `ALLPHOTOS.json` isn't listed as a photo: instead each photo gets a check
mark when its data is one of the entries in `ALLPHOTOS.json` at the pull request's head, as the
[combined data store](combined-data-store.md) has it (compared as JSON, so formatting and key order don't matter). Next to each photo's JSON it shows the photo from R2: the object at the JSON's `images.key` (or `images.full` URL)
when it has one, or else the newest `photos/<hash>-<name>.jpg` upload whose name matches the JSON's `file` (or the JSON
file's name), or a "no image" sign when there's none. Under the photo is its Square Thumbnail: the JSON's
`images.thumbnail`, or else the `-thumbnail.webp` next to the photo in R2, with a placeholder when R2 doesn't have one
(as for photos uploaded before Square Thumbnails). Its Thumbnail Preview (`images.thumbnailpreview`, or the
`-thumbnailpreview.webp` next to the photo) shows blurred behind it while it loads. Clicking it opens it at its full 500 × 500.

Each added file has a **Remove** button (`DELETE /api/photos/in-flight?path=…`). After asking, it removes the JSON
from the batch and deletes the image the page shows from R2 (skipped when R2 has none). A file only waiting for Commit
is just dropped; one committed to the pull request is deleted from its branch by the next Commit. Files already in the
portfolio can't be removed, since that would delete them from the portfolio on merge. Like every other save, the
removal doesn't change `ALLPHOTOS.json` until Commit; see
[Committing the combined files](combined-data-store.md#committing-the-combined-files). The **Synced** row says whether
the combined files have every change, with a **Commit** button when they don't, and each file they don't have yet is
marked "Not synced to ALLPHOTOS.json yet".

Each photo whose JSON was read and whose image is in R2 has an **Edit** button, which opens it on the Photo page in
edit mode (`/exif?edit=<path>`) to change the square its Square Thumbnail is cut from. The crop editor starts from the
crop saved with the thumbnail in R2 (`GET /api/photos/bucket/thumbnail-crop?key=…`, else the JSON's
`images.thumbnailcrop`, else the middle), on
the original photo from R2. **Save changes** (at the top right, to the right of the sync button, with **Back to the saved crop** beside it once the square has moved; what the save did is shown above the page's cards) first remakes the thumbnail and its Thumbnail Preview from the new
square (`POST /api/photos/bucket/versions` with `versions: ["thumbnail", "thumbnailpreview"]` and a `crop`, which
replaces the saved one), then saves the JSON as a change waiting for Commit (`PUT /api/photos/in-flight` with the
`path` and new `data`; removed files can't be edited, and photos already in the portfolio can be too, as the
[Gallery](gallery.md) describes). Both keep their R2 keys, so
the JSON's `images.thumbnail` and `images.thumbnailpreview` get a `?crop=x,y,size` query: a new URL that browsers and
Cloudflare's cache fetch afresh instead of showing the old square (R2 ignores the query), and `images.thumbnailcrop` the
new square. Saving any other change to a file without `images.thumbnailcrop` adds it too. The new square is in R2 at
once; the JSON goes to GitHub with the next **Commit**.

Under the photos it lists the album, tag, place, localization and metadata group files the pull request or the changes waiting for
Commit add or change, each with its JSON and a check mark when it's an entry of `ALLALBUMS.json`, `ALLTAGS.json`,
`PLACES.json`, `LOCALIZATIONS.json` or `METAINFO.json` at the same head, and the pull request summary counts them.
