# Saving photo data to GitHub

After a photo is analyzed on `/exif`, the **Save to GitHub** card saves its sanitized EXIF as one JSON file,
`<folder>/photos/<name>.json`, in the repository from Settings (`POST /api/photos/github` → `POST /photos/github`). Saves never
commit to the Settings branch directly. The first save creates a `photo-data/<date>-<time>` branch from it and opens an
**Add photo data** pull request; later saves add their files to that pull request for as long as it is open, so one
pull request collects every photo until you merge it. An existing file is never overwritten.

The sanitized EXIF has the original photo's `width` and `height` in pixels (as it's shown, so swapped for a photo
whose EXIF orientation turns it on its side), and an `images` object whose `full` is the photo's public R2 URL and `key`
its object key, and whose `xlarge`, `large`, `medium`, `small`, `xsmall` and `preview` are the public URLs of its resized versions
and `thumbnail` the public URL of its Square Thumbnail, with `thumbnailpreview` its low-res placeholder.
`thumbnailcrop` is where the Square Thumbnail is cut from, in pixels of the upright photo: "500 × 500 px from a
4220 × 4220 px square at 1710, 0" is `{ "x": 1710, "y": 0, "size": 4220, "outputSize": 500 }`. The
`images` links are `null` until you
upload the photo with **Upload to R2**, so upload before saving if the JSON should link to the photo. The
**JSON to Upload** tab shows exactly what Save to GitHub will write, and picks up the URL as soon as the upload finishes.

Once a photo is analyzed, the page first looks for it in the saved photo data on GitHub: `ALLPHOTOS.json` on the
Settings branch, from the [combined data store](combined-data-store.md), and each photo JSON file the open **Add photo
data** pull request adds or changes (`POST /api/photos/all-photos/check` → `POST /photos/all-photos/check`). The pull request's files are read directly, not its `ALLPHOTOS.json`, because CI
rebuilds that after every push and may not have caught up yet. An entry with the same `file`, `gpsPosition` and `createDate` (exactly equal, with `null` matching only `null`) means the
photo is already in the portfolio: the page shows that entry and hides **Upload to R2** and **Save to GitHub**, since
editing a saved photo isn't supported yet. If the check can't run (GitHub isn't set up, or the file can't be read), the
page says so and still offers both; if only one of the two places can be read, it checks that one and warns about the other.

Only JPEG photos can be uploaded. Along with the original `photos/<hash>-<name>.jpg`, **Upload to R2** puts six WEBP
versions next to it, scaled down to fit their longest edge (width or height) and keeping their proportions:
`photos/<hash>-<name>-xlarge.webp` (2500px), `-large.webp` (1800px), `-medium.webp` (1200px), `-small.webp` (500px) and
`-xsmall.webp` (250px), sized with high-density (Retina) screens in mind, plus `-preview.webp` (40px), a low-res
placeholder of a few hundred bytes to show blurred while a real version loads. A photo already smaller than
a version keeps its size. The Go backend turns the photo upright from its EXIF orientation, resizes it with
[imaging](https://github.com/disintegration/imaging) and encodes it at WEBP quality 95 (60 for the preview, which is shown blurred anyway; libwebp method 6, its slowest and smallest) with
[gen2brain/webp](https://github.com/gen2brain/webp) (libwebp compiled to pure Go, so the image needs no C library). The
versions carry no metadata.

The **Resized versions** card above **Upload to R2** has a button per version, plus **Original**, that opens it in a
full-window lightbox pixel for pixel on the screen (on a Retina screen that's half its CSS size, so the browser doesn't
stretch it and blur it), with a warning when the window is too small and it had to be scaled down. The preview is the exception: it's stretched to fill the window and smoothed with
`filter: blur(12px)`, as a page would show it while the real image loads, and the lightbox names that filter. For a version it
also says how much smaller the WEBP is than the same version saved as a JPEG at the original's own quality, estimated
from its quantization tables (the backend sends `X-Jpeg-Bytes` and `X-Jpeg-Quality` headers). That JPEG is only a
comparison: versions are always made straight from the original's pixels, never from a re-saved JPEG.
Each version is made exactly as an upload would make it (`POST /api/photos/versions/{xlarge,large,medium,small,xsmall,preview}` → `POST /photos/versions/{version}`, which
answers with the WEBP), so its quality can be checked before anything is uploaded. Removing a photo from Photos in Flight
deletes its versions, Square Thumbnail and Thumbnail Preview from R2 along with the original.

The **Square Thumbnail** card picks the part of the photo used where every photo gets the same square tile, such as the
portfolio's Grid. It starts as the largest square in the middle of the photo (what `object-fit: cover` would show); drag
the square to move it, drag a corner to resize it, or focus it and use the arrow keys (Shift for bigger steps) and `+`
and `-`. A preview next to it shows the Square Thumbnail as it will look. **Upload to R2** sends the square as `cropX`, `cropY`
and `cropSize` form fields before the photo (in pixels of the photo turned upright, as the browser shows it), and the
backend cuts it out and scales it, up or down, to exactly 500 × 500 px, `photos/<hash>-<name>-thumbnail.webp` at WEBP
quality 95, with the square saved in its `crop` object metadata (`x,y,size`) so remaking it on Manage Sizes keeps it.
Without those fields it uses the middle square. The same square also becomes the **Thumbnail Preview**,
`photos/<hash>-<name>-thumbnailpreview.webp`: 40 × 40 px at WEBP quality 60, the Square Thumbnail's own low-res
placeholder (well under a kilobyte) to show blurred while the 500 × 500 one loads, saved as `images.thumbnailpreview`.
The square can be changed later from Photos in Flight's **Edit** button. The Grid shows a photo's `thumbnail` when it has one, over its
blurred `thumbnailpreview` (or the photo's `preview` for thumbnails saved before previews of them existed), and the
middle of its resized versions for photos saved before thumbnails existed.

> **Frontend analogy:** it's `srcset` prepared ahead of time: one source image, five sizes for the portfolio to pick
> from, plus a tiny `preview` for the blur-up trick (show it stretched with `filter: blur()` as the `<img>`'s background
> until the real image loads).

Before uploading, **Upload to R2** looks in the bucket for a different photo saved under the same name
(`photos/<hash>-<name>.jpg` with another hash), since Photos in Flight matches photos by name. If there is one, it shows
that photo and asks for a new name, or you can keep the name anyway (a `sameName=keep` form field before the photo). When
Cloudflare rejects a request, the card also shows Cloudflare's own answer (HTTP status, error code and message) under
the plain-language reason.

The GitHub token needs **Contents: Read and write** and **Pull requests: Read and write**. **Actions: Read-only** is
optional: with it, Photos in Flight can tell when CI has rebuilt `ALLPHOTOS.json` after a removal.

> **Frontend analogy:** it's like a "drafts" cart. Each save drops a file in the cart (the open pull request), and
> merging the pull request is checkout. After that, the next save starts a new cart.
