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
a change waiting for Commit is marked **Waiting for Commit** and has no GitHub link yet. The summary shows the pull request, its branch, the photo count and **Synced**; how the files match
`ALLPHOTOS.json` and the other combined files, and how many images R2 has, are under **File checks**, collapsed until
it's opened. With no pull request open, the
summary says how many files are waiting, with **Commit**, which opens one. **Refresh** asks GitHub again
(`?refresh=1`), rather than using the backend's read from when it started, so a merge made on GitHub shows at once. `ALLPHOTOS.json` isn't listed as a photo: instead each photo gets a check
mark when its data is one of the entries in `ALLPHOTOS.json` at the pull request's head, as the
[combined data store](combined-data-store.md) has it (compared as JSON, so formatting and key order don't matter). Next to each photo's JSON it shows the photo from R2: the object at the JSON's `images.key` (or `images.full` URL)
when it has one, or else the newest `photos/<hash>-<name>.jpg` upload whose name matches the JSON's `file` (or the JSON
file's name), or a "no image" sign when there's none. Under the photo is its Square Thumbnail: the JSON's
`images.thumbnail`, or else the `-thumbnail.webp` next to the photo in R2, with a placeholder when R2 doesn't have one
(as for photos uploaded before Square Thumbnails). Its Thumbnail Preview (`images.thumbnailpreview`, or the
`-thumbnailpreview.webp` next to the photo) shows blurred behind it while it loads. Clicking it opens it at its full 500 × 500.

While the page reads Settings, the pull request and the drafts, it shows gray placeholders in the shape of what's
coming (the summary's rows, the filter bar, a photo with its JSON, a row of draft tiles, and the `ALLPHOTOS.json`
panel), so nothing jumps when they arrive. With no photo files in flight it says **No photos in flight** in a dashed
box, and with no drafts on the base branch it says so under **Drafts on `<branch>`** rather than leaving the section
out; if the drafts can't be read, it says why.

> **Frontend analogy:** these are skeleton screens, like a feed that draws gray cards before its posts load, so the
> layout is reserved and the content fills it in place.

The photos are listed under a **Photos in flight** heading with their count; clicking it collapses them (they start
open), so the drafts and Undecided panels below are easy to reach.

### Filters

Above the photos, a filter bar has **Any**, **With** and **Without** for each of: **Title** (a `title` that isn't
blank), **Place** (any `places`, or a `placeName`), **GPS position** (a `customGpsPosition` or the EXIF
`gpsPosition`), **Albums**, **Tags**, **Genres** and **Re-edit mark** (`reEdit`). The chosen filters all apply together, to the
list and the Undecided queue (the [drafts on the base branch](#drafts-on-the-base-branch) have their own), reading each photo's JSON with its
[local edits](combined-data-store.md#local-edits) made. With any chosen, it says how many photos are shown, with
**Clear filters**. A photo whose JSON couldn't be read is hidden while a filter is chosen. They're kept in the URL
(such as `?title=without&place=with`), so a reload or a shared link keeps them. Album, tag and other files below the
photos aren't filtered. The [Gallery](gallery.md) has the same filters.

> **Frontend analogy:** it's the faceted filter on a shop's product list, where each facet is a three-way toggle
> stored in the query string.

### Undecided

An untitled photo's **Undecided** button sets it aside in the **Undecided** panel above the list, collapsed to how many it has until it is opened, out of the list of
photos in flight, and **Next untitled photo** skips it. Each photo there has **Edit**, to name it on the Photo page,
and **Move back**. The mark is the photo JSON's `undecided: true`, kept as a
[local edit](combined-data-store.md#local-edits) until **Commit** saves it to the file (moving a photo back sets it to
`null`). Only untitled photos are in the queue, so giving one a title puts it back in the list. An Undecided photo is
still a draft, so the portfolio doesn't show it; with drafts turned off in Settings it goes in `ALLPHOTOS.json` like any
other untitled photo.

> **Frontend analogy:** it's like archiving an email: the message is still there, it just leaves the inbox view until
> you open the Archive folder or move it back.

### Drafts on the base branch

After the photos in flight (or alone, when none are), the page lists the [drafts](drafts.md) already on the base
branch that the pull request doesn't change (read with the
Gallery's `GET /api/photos/published`): the Undecided ones in the **Undecided** panel (**Undecided on `<branch>`** when photos are in flight too, to tell it apart from theirs) and
the rest under **Drafts on `<branch>`**, each with **Edit**, which opens it on the Photo page as the Gallery does, and **Undecided** or **Move
back**. Naming one and saving it puts it back in flight, and Commit sends it to a new pull request. Nothing is listed
when untitled photos aren't kept as drafts.

The drafts have their own filter bar, with the same filters as the photos in flight, kept in the URL under a `draft`
prefix (such as `?draftPlace=without`), so filtering one list doesn't hide photos in the other. They apply to the
drafts' Undecided panel too. Its **Sort** sets the order: **File name** (the JSON file's name, with numbers in order,
the default), **Date taken** (newest first, as the Gallery's) or **Recently saved** (newest first). Drafts have no
date added, so Recently saved goes by photo ID, which is given out in order as each file is made. It's kept as
`?draftSort=taken` or `?draftSort=saved`.

> **Frontend analogy:** two independent faceted lists on one page, each with its own namespaced query-string keys,
> like `?productColor=red&reviewRating=5`.

Each added file has a **Remove** button (`DELETE /api/photos/in-flight?path=…`). After asking, it removes the JSON
from the batch and deletes the image the page shows from R2 (skipped when R2 has none). A file only waiting for Commit
is just dropped; one committed to the pull request is deleted from its branch by the next Commit. Files already in the
portfolio can't be removed, since that would delete them from the portfolio on merge. Like every other save, the
removal doesn't change `ALLPHOTOS.json` until Commit; see
[Committing the combined files](combined-data-store.md#committing-the-combined-files). The **Synced** row says whether
the combined files have every change, with a **Commit** button when they don't, and each file they don't have yet is
marked "Not synced to ALLPHOTOS.json yet".

Each photo whose JSON was read and whose image is in R2 has an **Edit** button at the left of its heading, before its title, which opens it on the Photo page in
edit mode (`/exif?edit=<path>`) to change the square its Square Thumbnail is cut from, or to
[replace its image](replace-image.md) with a re-edit. The crop editor starts from the
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

Under the photos it lists the album, tag, genre, place, localization, metadata group, camera override and custom lens files the pull request or the changes waiting for
Commit add or change, each with its JSON and a check mark when it's an entry of `ALLALBUMS.json`, `ALLTAGS.json`, `ALLGENRES.json`,
`PLACES.json`, `LOCALIZATIONS.json`, `METAINFO.json`, `CAMERAS.json` or `LENSES.json` at the same head, and the pull request summary counts them.
