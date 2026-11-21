# Deleting a photo

The Photo page (`/exif?edit=<path>`) has a **Delete photo** card at the end of **Details**, for a photo new in the photo data pull request or one already in the portfolio. Its button opens a dialog that asks first, listing what goes with the photo, since its images can't be brought back. **Cancel** or **Esc** closes it without changing anything; it can't be closed while the delete runs.

**Delete photo** sends `DELETE /api/photos/saved?path=<path>`, and the backend (`DeletePhoto` in `apps/be-pipeline/internal/github/photodelete.go`) saves, as one change waiting for **Commit**:

| What | Change |
| --- | --- |
| The photo's JSON file | Deleted. A photo only saved in the app is just dropped; one in the portfolio leaves it when the pull request merges, and `ALLPHOTOS.json` with it |
| Albums | Its ID comes out of every album's `photoOrder`, `covers` and `layout` (a row left with neither photos nor text goes), as **Remove** on an album page does |
| Other photos' `unselected` | Its ID comes out of their `winners` ([Unselected Photos](compare-groups.md#unselected-photos)); every other byte of those files stays |
| The bio | It comes off the bio's photos, which name it by path ([Bio](bio.md)) |
| Viewer likes | Its ID comes out of each viewer's `photos` ([Viewer Likes](viewer-likes.md)) |
| Photo books | A place on a page that held it is left empty, with its caption ([Photo Book](photo-book.md)) |
| Trip lines | It comes out of the day's segments, hand-made order, trip stops' casual photos and areas. A spot or stop that came after it comes after the photo before it instead (a stop after the day's first photo becomes first). A segment left with fewer than two points, or an area with no photos, goes ([Trip Lines](trip-lines.md)) |

A photo's compare group and its other marks are in its own file, so they go with it. A file without an `id` has nothing pointing at it by ID, so only the bio and photo books are looked at. Nothing is saved when the photo's file, or any photo file whose `unselected` names it, can't be read.

Then, with the JSON saved, the backend deletes from R2 right away, as removing a photo in flight does: the image the Photos in Flight page shows for it, every resized version, the Square Thumbnail and its Thumbnail Preview, and its [unedited original](unedited-originals.md) (`original.images.key`) with that original's versions. It answers even when an image couldn't be deleted, saying why. Discarding the pending change brings the JSON back, but not the images.

The editor gives way to what the delete did: the other files it changed (all waiting for Commit), what was deleted from R2 and anything that couldn't be, with links back to the Gallery and Photos in Flight. Opening another photo clears it.

> **Frontend analogy:** it's a cascading delete done by hand. The JSON file is the row, the albums, trip lines and likes are the foreign keys pointing at it, and the backend nulls or removes each reference in the same transaction (one save) so nothing is left pointing at a photo that isn't there. The R2 files are like uploaded blobs, deleted straight after, outside the transaction.
