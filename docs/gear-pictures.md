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
  "subject": { "x": 0.1, "y": 0.2, "width": 0.8, "height": 0.6 },
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
- **`subject`** is the box around the camera or lens in `original`, found when it was uploaded, which **Fit to
  limits** fits inside the limit lines. It's missing for pictures uploaded before boxes were found.

Saving or removing one (`PUT /api/gear/<id>` → `PUT /gear/{id}`, `DELETE /api/gear/<id>` → `DELETE /gear/{id}`) is a
[change waiting for Commit](pending-changes.md), counted by the sync button as a gear picture. Photos in Flight lists
the files under **Gear pictures**. Locally, `pnpm photos:local` also makes `GEAR.local.json`, which the portfolio uses
in place of the committed file.

## The picture and its crop

The crop is a normalizer: pictures come from store pages in any size, shape and format, and every crop comes out the
same 267 × 200 WEBP with the gear the same size and place in it.

Choosing a picture (`POST /api/gear/image` → `POST /gear/image`, a multipart form with the file as `image`) uploads it
to R2 at once, like a photo, since the file only points at it. It can be a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF of
up to 20 MB, of any size or shape. The backend keeps it as it is, under `gear/originals/<hash>-<name>.<ext>`, and
answers with its link, its size upright, and its **subject**: the box around everything that isn't plain background.
It shrinks the picture to 400px, takes the average of its four corners as the background, and counts a pixel as
background when it's (nearly) see-through or within 24 of that color in every channel, so a store page's white, a
faint shadow on it, or a transparent PNG's nothing are all trimmed. A picture with no plain background is its own
subject. The page then cuts its first crop: the subject as big as fits inside the [limit lines](#the-page), centered
between them, with white around it.

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
info pane will show it (the drawing until a picture is chosen), the picture to upload (its crop is cut, fitted inside
the limit lines, as soon as it's uploaded), **Use the drawing** to clear it, and the description. **Save picture** (or
**Save changes**) and **Remove picture** keep the file as a change waiting for Commit. The pipeline's own Gallery shows
the committed pictures, since it imports the portfolio's filters.

### Crops

Under them, **Camera crops** (or **Lens crops**, following the tab) lines up every picture of that kind at once, not
one camera's. It's a frame the shape of the 267 × 200 crop with every picture drawn in it by its crop, faint, with
**Others** setting how faint, and dashed lines across the middle. The list beside it chooses pictures (**All**,
**None**, or one by one): the chosen ones are drawn on top, mostly opaque (85%, so the others still show through a little), and everything done in the frame changes all of
them together. Dragging moves them; **Zoom out** and **Zoom in** scale them; **Fit to limits** fits each one's subject
inside the limit lines (a picture uploaded before subjects were found can't be fitted); **Whole picture** shows each
whole, centered; **White fill** and **Transparent fill** set what fills the room around them; **Reset** puts their
crops back as saved. A picture from before crops starts at its whole picture, so it shows as changed.

**Limits** draws a red line, above every picture, in from the top, bottom, left and right, each a percentage of the frame (0 for none), with
the space past it shaded, to fit every picture inside. The limits are a preference kept in this browser's local
storage (`servenup-gear-crop-limits`), the same for every camera and lens, and aren't saved in the gear files.

The list marks each picture whose crop has changed, and **Cut and save** cuts every changed crop, chosen or not, and
saves its file, one after another, each a change waiting for Commit.
