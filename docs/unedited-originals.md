# Unedited originals (Raw vs Edited)

A saved photo can keep its **unedited original**, the JPEG straight from the camera, to compare with the edit. The
pipeline always has it; the portfolio shows it only on photos where it's marked to, on a minor page called
**Raw vs Edited**.

## In the pipeline: the Photo page's Original section

The Photo page for a saved photo (`/exif?edit=<path>`) has an **Original** section (`?section=original`,
`components/edit-in-flight/unedited-original-card.tsx`). Every card in it saves the photo's JSON straight away, as a
[change waiting for Commit](pending-changes.md), so like Replace image it waits while other changes are unsaved.

- **Unedited original** (or **Replace the unedited original** once there is one): choosing a JPEG reads its size
  (`POST /api/exif`), and **Upload original** uploads it (`POST /api/upload`) under the photo's own file name with
  `-original` after it, so its key is `photos/<hash>-dscf4800-original.jpg`, with every resized version and a Square
  Thumbnail as for any photo. It doesn't touch the photo's own image. Replacing the original starts its crop and
  pixelation over and takes it off the portfolio, since they were for the old one.
- **Original vs edited**: the two compared, as the portfolio draws them (see [The comparison](#the-comparison)), with
  **Show on the portfolio** and **Remove original**. Removing only takes it off the JSON; its files stay in R2, to
  delete from [Explore Bucket](explore-bucket.md), where an original saved on a photo is marked like the photo.
- **The edit's crop**: for an edit cropped from the original, the part of the original the edit shows. It's a box in
  the edit's shape over the original: drag it to move it and its corner to size it, then **Save crop**. Until one is
  saved, it's the largest part of the original in the edit's shape, in its middle (all of it when the two are the
  same shape). **Largest in the middle** goes back to that.
- **Pixelate the original**: the [face editor](face-pixelation.md) on the original, with **Find faces**, boxes,
  circles, keep areas and densities, remaking the original's versions with them (`POST /api/photos/bucket/versions`
  with the original's key). It starts with the photo's own pixelated areas **scaled from the edit into the crop**
  (each area's position and size times the crop's size over the edit's, plus the crop's corner; density, shape and
  turn stay the same), and **Add the photo's areas** adds them again after any changes. Faces the edit cropped out
  aren't on the photo, so box them here. The original JPEG itself isn't changed.

> **ELI5:** the edit is a photo of a smaller window in the original. To put a sticker over the same face on the
> original, measure where it sits in the small window, then find that spot in the bigger picture by the window's
> position and how much it was zoomed.

## Showing it on the portfolio

**Show on the portfolio** sets `showOnPortfolio`. The portfolio shows the original only when that's on **and** the
original's areas were saved against the photo's areas as they are now (`matchedFaces` equals the photo's `faces`), so
a face hidden on the edit is never shown on the original:

- A photo with no pixelated faces needs nothing more.
- A photo with pixelated faces needs **Pixelate every version** saved once on the original.
- When the photo's faces are pixelated again later, the original is held back until its areas are saved again
  (**Keep the original's areas as they are** saves them unchanged, after checking).

The rule is `isPublishedOriginal` in `apps/portfolio/src/lib/unedited-original.ts`, which both apps use.

## Keeping it private

The original is in the photo's JSON and so in `ALLPHOTOS.json`, which the pipeline reads. The portfolio's
`private-photo-notes` Vite plugin (`apps/portfolio/private-notes.ts`, as for [photographer notes](photo-notes.md))
takes `original` off every photo the portfolio may not show, and off the rest leaves only its size, crop and resized
versions, without the JPEG's address or key. So an original that isn't shown never reaches the built site. It is
still in the repository's photo files, like `images.full` (see
[What isn't hidden](face-pixelation.md#what-isnt-hidden)): anyone who can read the repository can find its JPEG.

> **Frontend analogy:** like a build step that tree-shakes a feature flag that's off: the data lives in the source,
> but only what the flag lets through is bundled.

## The comparison

`EditComparison` (`apps/portfolio/src/components/edit-comparison.tsx`, imported by the pipeline with `@portfolio/`)
has three modes, picked with **Slider**, **Side by side** and **Switch**:

- **Slider**: the original over the edit, cut off at a line. Pressing anywhere on the photo moves the line there and
  it follows the pointer while held; the round grip on it is a slider the arrow keys move (Shift for 1%, Home and End
  for the ends). The original is on the left of the line.
- **Side by side**: the whole original and the edit next to each other, one above the other on a phone.
- **Switch**: one at a time, switched by clicking the photo or the **Edited** and **Original** buttons. Both stay
  loaded, so switching is instant.

The Slider and Switch draw the original's crop stretched to the edit's box, so the two line up.

## On the portfolio: Raw vs Edited

`/raw-vs-edited` (`routes/raw-vs-edited.tsx`) is a minor view, listed in the site menu's small links only once at
least one photo's original is shown there. The menu knows without loading the photos: the `shown-originals` Vite
plugin (in `private-notes.ts`) counts them from the same photo list the app reads and gives the count as
`virtual:shown-originals`. It lists the
photos with a shown original, newest first, each as a square split down the middle (original on the left), and
`?photo=<id>` opens one compared with its original, with the mode kept as `?mode=side` or `?mode=switch`. The photo
viewer has a button for it (a split square, before Copy link) on photos with a shown original.

## The field

```json
"original": {
  "file": "DSCF4800.jpg",
  "width": 6240,
  "height": 4160,
  "images": { "full": "…-original.jpg", "key": "photos/…-original.jpg", "large": "…?faces=m1", … },
  "showOnPortfolio": true,
  "crop": { "x": 312, "y": 208, "width": 5616, "height": 3744 },
  "faces": [{ "x": 1200, "y": 600, "width": 80, "height": 80, "blocks": 8 }],
  "matchedFaces": [{ "x": 100, "y": 50, "width": 40, "height": 40, "blocks": 8 }]
}
```

Only photos with an original have it; it isn't in `newPhotoJSON`, and the backend saves it as the pipeline sends it.
`crop`, `faces` and `matchedFaces` are left out until they're saved. `faces` is in the original's own pixels, as the
photo's `faces` are in the edit's.
