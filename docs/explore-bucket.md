# Explore Bucket

`/bucket` shows every image in the R2 bucket from Settings (`GET /api/photos/bucket` → `GET /photos/bucket`), newest
first, under any prefix: objects ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` or `.avif`. Each tile shows the image
from the bucket's public URL with its key, size and upload time, and links to the full image. It needs the R2 keys,
bucket and public URL in Settings, and only changes R2 when you [delete](#deleting) an image. An image whose photo data is still in the open **Add photo
data** pull request is faded with a pull request badge, and so are that photo's resized versions.

Each original is shown as a stack, with blank squares behind it standing for its resized copies (keys
`<original stem>-<version>.webp`). Clicking the stack puts the copies right after the original in the grid, largest
first, each labelled with its size (for example "Large · 1800px"); clicking it again collapses them. The key under a
tile links to the image. A resized copy whose original isn't in the bucket shows on its own, still labelled.

A photo already in `ALLPHOTOS.json` (on the base branch, or in the pull request's copy) gets a book badge
(both come from the [combined data store](combined-data-store.md)). An entry matches by its saved
`images.key`, then its `images.full` URL, then by the name stem in the original's key. An original JPEG that is neither
in flight nor in `ALLPHOTOS.json` gets a **Generate JSON** button, which opens a modal that reads the original
from R2 (`POST /api/photos/bucket/exif` with `{ "key" }` → `POST /photos/bucket/exif`) through the same EXIF and color
analysis as `POST /exif`. The JSON gets the original's URL and key and the URLs of the resized copies in the bucket, and
its `file` is the name kept in the key (`photos/<hash>-dsc0001.jpg` gives `dsc0001.jpg`). After the same
`ALLPHOTOS.json` check as Add Photo, **Add to Batch** asks for the JSON file name and adds it to the photo data pull
request. The button only shows once both checks have run, so it needs the GitHub settings too.

## Filters

Above the grid, a filter bar narrows the tiles (each original with its stack, or a copy on its own):

- a search box that keeps the images whose key has the text in it, ignoring case (`?q=dsc0001`)
- **Photo data**: **Any**, **Not saved**, **In flight** or **Saved**, from the same marks as the badges (`?data=unsaved`).
  It only shows once both checks have run, so it needs the GitHub settings too
- **Resized copies**: **Any**, **With** or **Without**, for finding originals uploaded without their copies
  (`?copies=without`)

They all apply together and are kept in the URL, so a reload or a shared link keeps them. With any chosen, it says how
many photos are shown, with **Clear filters**.

> **Frontend analogy:** it's the same faceted filter as [Photos in Flight](photos-in-flight.md#filters), with each
> facet stored in the query string.

## Deleting

Every tile has a **Delete** button, which opens a modal before anything is deleted. For an original with resized copies,
**Also delete its N resized copies** is ticked by default. The modal warns when photo data still points at the image:
in the open **Add photo data** pull request (where removing the photo in Photos in Flight is the better way, since that
takes out its JSON too), in `ALLPHOTOS.json` (the portfolio would show a broken image), or when that couldn't be
checked; the button then reads **Delete anyway**. Only R2 changes: photo data is never edited from here.

Deleting sends `POST /api/photos/bucket/delete` with `{ "keys": [...] }` (at most 20) → `POST /photos/bucket/delete`,
which deletes each image key (an image file extension, under any prefix) and answers with `deleted` and `failed` keys,
each failure with why. The modal closes once all are gone, lists any that weren't, and the listing is read again.

> **Frontend analogy:** it's a `DELETE` per object behind one batched `fetch`, answering like `Promise.allSettled`:
> which went through and which didn't.
