# Replace image

The Photo page for a saved photo (**Edit** in Photos in Flight or the Gallery, `/exif?edit=<path>`) has a **Replace
image** card, for a re-edit of the same shot. Choosing a new JPEG reads it (`POST /api/exif`, as for a new photo), and
**Replace image** uploads it (`POST /api/upload`) with every resized version, its blurred Preview, the Square Thumbnail
and the Thumbnail Preview, then saves the photo's JSON with the new links as a [change waiting for
Commit](pending-changes.md). It's `ReplaceImageCard` in `apps/client-pipeline/src/components/edit-in-flight/`.

## What the photo keeps

Everything but its image: its `id`, so [links to it](data-model.md#photo-ids) keep working, its `file`, title,
comment, place name, places, custom city and country, albums, tags, spotlight zones, publish fields and social posts.
Its `width` and `height` come from the new JPEG, and its `images` point at the new upload.

The camera, lens, settings, date, GPS position, country and city stay as saved, since an edited export often has
little or no EXIF. **Use the new image's EXIF too** takes them, and `exifOriginals`, from the new JPEG instead, with
the [camera overrides](camera-overrides.md) applied as for a new photo and the photo's [custom
lens](custom-lenses.md) and manual aperture made over them again. The card warns when the new JPEG's EXIF has no
camera or date, since taking it would clear them.

## The Square Thumbnail

When the new JPEG is the same size as the old (its `width` and `height`), the Square Thumbnail is cut from the same
square. Otherwise the old square may not fit, so a **New image's Square Thumbnail** card under it picks one on the new
JPEG, starting in the middle, before **Replace image** can be pressed.

## Where the new image goes in R2

The new JPEG is uploaded under the old one's file name, so its key is `photos/<new hash>-<same name>.jpg`, next to the
old image rather than over it. The old image and its versions stay in R2, because the portfolio keeps showing them
until the pull request merges; delete them afterwards from [Explore Bucket](explore-bucket.md).

> **Frontend analogy:** it's a content-hashed asset, like `main.3f9a1c.js` from a bundler. A new file gets a new URL
> instead of overwriting the old one, so no browser or CDN cache can serve the old picture under it, and the page
> still on the old HTML (here, the portfolio before the merge) keeps working.

The colors the Photo page shows aren't saved in the photo's JSON, so there's nothing to recompute there.
