# Gear Pictures

`/gear-pictures`, under **Configuration** in the sidebar, gives a camera or lens its own picture and a few words about
it. The portfolio's **Gear & settings** filter shows the picture in place of its drawing of that kind of camera (a
DSLR, mirrorless, compact or phone) or of the lens, at the top of the **(i)** info pane for a camera or lens, with the description under its name (see
[Filters](portfolio-filters.md)).

> **Frontend analogy:** it's an avatar for each camera and lens. The photos keep naming their camera as text, and
> `GEAR.json` is a lookup from that name to an image URL, like a `users` map that a comment's `authorName` is looked
> up in to show a profile picture, with the generated drawing as the fallback avatar.

## The file

Each camera's or lens's picture is one file, `gear/<id>.json`, and **Commit** combines them into `gear/GEAR.json` the
way it combines the custom lenses into `LENSES.json`:

```json
{
  "id": "camera-fujifilm-x-t5",
  "kind": "camera",
  "name": "Fujifilm X-T5",
  "image": "https://cdn.servenupphotos.net/gear/0a1b2c3d4e5f-x-t5.webp",
  "original": "https://cdn.servenupphotos.net/gear/originals/9a8b7c6d5e4f-x-t5.jpg",
  "crop": { "x": 0.05, "y": -0.1, "width": 0.9, "height": 1.35, "fill": "white" },
  "description": "My everyday camera since 2024."
}
```

- **`kind`** is `camera` or `lens`.
- **`name`** is the camera or lens exactly as the photo files name it, after the [camera overrides](camera-overrides.md)
  and [custom lenses](custom-lenses.md), so it matches the filter's choices (ignoring case). Only one file can be for a
  camera, or for a lens, by name. The ID is `camera-` or `lens-` and the name, made when the file is first saved.
- **`image`** is the link in R2 of the picture's crop, the version the portfolio shows, or `""` to keep the drawing.
  **`description`** is up to 1000 characters, or `""`. A file needs one of them.
- **`original`** is the link of the picture as it was uploaded, and **`crop`** the part of it that `image` shows, as
  fractions of the original's width and height. A crop can reach past the original's edges (a negative `x`, or a
  `width` over 1), and `fill` says what fills that room: `"white"`, or transparent when it's missing. Files saved
  before crops have only `image`; the page crops that picture as their original.

Saving or removing one (`PUT /api/gear/<id>` → `PUT /gear/{id}`, `DELETE /api/gear/<id>` → `DELETE /gear/{id}`) is a
[change waiting for Commit](pending-changes.md), counted by the sync button as a gear picture. Photos in Flight lists
the files under **Gear pictures**. Locally, `pnpm photos:local` also makes `GEAR.local.json`, which the portfolio uses
in place of the committed file.

## The picture and its crop

Choosing a picture (`POST /api/gear/image` → `POST /gear/image`, a multipart form with the file as `image`) uploads it
to R2 at once, like a photo, since the file only points at it. It can be a JPEG, PNG or WEBP of up to 20 MB. The
backend keeps it as it is, under `gear/originals/<hash>-<name>.<ext>`, and answers with its link and its size upright.
The page then cuts its first crop: the whole picture, centered, with white around it.

Cutting a crop (`POST /api/gear/crop` → `POST /gear/crop`, with `{ "original": <link>, "crop": { … } }`) reads the
original back from R2, turns it upright, cuts the crop out, fills the room past its edges (and behind a transparent
picture) with the crop's `fill`, and scales it to **267 × 200**, 4:3 and 200px tall, the size the info pane shows. It
saves that as a WEBP at quality 90 under `gear/<hash>-<name>.webp`. Each hash is of the file itself, so a new picture or
crop always gets a new link. The original must be under `gear/` in the configured bucket. Removing a file, picking
another picture or cutting another crop leaves the old ones in R2.

> **Frontend analogy:** like keeping a user's full-size avatar upload and storing the crop box from a cropper widget
> next to it, then rendering the small cropped thumbnail on the server once, so every page loads the small image.

## The page

The left lists every camera or lens (a tab for each) that the photos name, most photos first, with a picture mark on the
ones that have one, then any file for one no photo names any more. The right edits the chosen one: a preview as the
info pane will show it (the drawing until a picture is chosen), the picture to upload, **Use the drawing** to clear it,
the crop, and the description.

**Crop** is a frame the shape of the 267 × 200 crop. Drag the picture to move it, and use **Zoom** to make it bigger or
smaller; zooming out gives it room around it, which **Fill** makes **White** or **Transparent** (a checkerboard). Every
other camera's crop (or every other lens's) is drawn over it, faint, with **Others** setting how faint, and dashed
lines cross the middle, so each picture can be given the same size and place as the rest. **Limits** draws a red line
in from the top, bottom, left and right, each a percentage of the frame (0 for none), with the space past it shaded, to
fit every picture inside. The limits are a preference kept in this browser's local storage
(`servenup-gear-crop-limits`), the same for every camera and lens, and aren't saved in the gear files. **Whole picture** goes back
to the whole picture, centered. **Cut crop** makes the crop in R2; until then the page says the crop isn't cut yet,
and saving keeps the last crop cut. **Save picture** (or **Save changes**) and **Remove picture** keep the file as a change waiting
for Commit. The pipeline's own Gallery shows the committed pictures, since it imports the portfolio's filters.
