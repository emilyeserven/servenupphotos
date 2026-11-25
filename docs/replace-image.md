# Re-editing a photo

A photo can be marked for re-editing, with a reason, and its image replaced with the re-edit, keeping everything else.

## Marking a photo for re-editing

The Photo page for a saved photo has a **Re-edit** card: **Marked for re-editing**, and a **Reason** such as "Too warm" once it's on (or, quicker, **Re-edit** beside **Compare** in [Photos in Flight](photos-in-flight.md#undecided), which saves it straight away). **Save changes** writes it into the photo's JSON as `reEdit`, a [change waiting for Commit](pending-changes.md):

```json
"reEdit": { "reason": "Too warm", "date": "2026-10-23" }
```

`date` is the day it was first marked, kept when only the reason changes; `reEdit` is `null` when the photo isn't marked, and Update Data's **Missing fields** adds that to older files. The Gallery's tiles and Photos in Flight show "Re-edit" and the reason on a marked photo (the Gallery shows the portfolio's copy, so a mark appears there once the pull request merges). The portfolio doesn't use it, but `ALLPHOTOS.json` carries it, so keep the reason to something you don't mind being public. Replacing the image takes the mark off.

### The Re-Edit page

**Re-Edit** under **Images** in the sidebar (`/re-edit`) lists every marked photo in one place: the photos from the Gallery and Photos in Flight with their [local edits](combined-data-store.md#local-edits), so marks waiting for Commit (such as [Quality Check](quality-check.md)'s flags) show at once. Unselected photos and photos without an image are left out, as Quality Check leaves them out. Each row has the photo's Small version, its title and file name, the reason (or "No reason given"), whether it's in the portfolio or in the pull request, the day it was marked, and **Open the photo**, which opens its Image section on the Photo page to [replace the image](#replace-image). The most recently marked come first. The page is `components/re-edit-list.tsx`; the list's order is `markedPhotos` in `lib/re-edit.ts`.

## Replace image

The Photo page for a saved photo (**Edit** in Photos in Flight or the Gallery, `/exif?edit=<path>`) has a **Replace image** card, for a re-edit of the same shot. Choosing a new JPEG reads it (`POST /api/exif`, as for a new photo), and **Replace image** uploads it (`POST /api/upload`) with every resized version, its blurred Preview, the Square Thumbnail and the Thumbnail Preview, then saves the photo's JSON with the new links as a [change waiting for Commit](pending-changes.md). It's `ReplaceImageCard` in `apps/client-pipeline/src/components/edit-in-flight/`.

### What the photo keeps

Everything but its image: its `id`, so [links to it](data-model.md#photo-ids) keep working, its `file`, title, comment, place name, places, custom city and country, albums, tags, spotlight zones, publish fields and social posts. Its `width` and `height` come from the new JPEG, its `images` point at the new upload, and its `reEdit` mark is taken off.

The camera, lens, settings, date, GPS position, country and city stay as saved, since an edited export often has little or no EXIF. **Use the new image's EXIF too** takes them, and `exifOriginals`, from the new JPEG instead, with the [camera overrides](camera-overrides.md) applied as for a new photo and the photo's [custom lens](custom-lenses.md) and manual aperture made over them again. The card warns when the new JPEG's EXIF has no camera or date, since taking it would clear them.

### The Square Thumbnail

When the new JPEG is the same size as the old (its `width` and `height`), the Square Thumbnail is cut from the same square. Otherwise the old square may not fit, so a **New image's Square Thumbnail** card under it picks one on the new JPEG, starting in the middle, before **Replace image** can be pressed.

### Where the new image goes in R2

The new JPEG is uploaded under the old one's file name, so its key is `photos/<new hash>-<same name>.jpg`, next to the old image rather than over it. The old image and its versions stay in R2, because the portfolio keeps showing them until the pull request merges; delete them afterwards from [Explore Bucket](explore-bucket.md).

> **Frontend analogy:** it's a content-hashed asset, like `main.3f9a1c.js` from a bundler. A new file gets a new URL instead of overwriting the old one, so no browser or CDN cache can serve the old picture under it, and the page still on the old HTML (here, the portfolio before the merge) keeps working.

## A photo missing from R2

A photo's JSON can be saved without its image in R2, such as one saved before its upload finished, so its `images` links are all `null`. The Photo page can't edit it as usual, since there's nothing to cut a Square Thumbnail from, so it opens on an **Upload the missing image** card instead, with the saved JSON under it. Choosing the JPEG reads it, a **New image's Square Thumbnail** card picks its square (starting in the middle), and **Upload image** uploads it under the photo's `file` name and saves the JSON as for [Replace image](#replace-image), keeping its EXIF and taking only the new `width`, `height` and `images`. Once the save is done, the page opens the photo's usual editor. It's `MissingImageEditor` in `components/edit-in-flight/missing-image-card.tsx`. A saved photo is only treated as missing when R2 could be searched; when it couldn't, the page says why instead.

The new photo page's **Save** waits for the upload, so a new photo isn't saved this way any more ([Saving photo data to GitHub](saving-to-github.md)).

> **Frontend analogy:** it's a broken `<img src>` with a "re-upload" button next to it, rather than a page that refuses to render because one asset 404s.

The colors the Photo page shows aren't saved in the photo's JSON, so there's nothing to recompute there.
