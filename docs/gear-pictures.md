# Gear Pictures

`/gear-pictures`, under **Configuration** in the sidebar, gives a camera or lens its own picture and a few words about
it. The portfolio's **Gear & settings** filter shows the picture in place of its drawing of that kind of camera (a
DSLR, mirrorless, compact or phone) or of the lens: beside the camera in the **Cameras** list, and at the top of the
**(i)** info pane for a camera or lens, with the description under its name (see
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
  "description": "My everyday camera since 2024."
}
```

- **`kind`** is `camera` or `lens`.
- **`name`** is the camera or lens exactly as the photo files name it, after the [camera overrides](camera-overrides.md)
  and [custom lenses](custom-lenses.md), so it matches the filter's choices (ignoring case). Only one file can be for a
  camera, or for a lens, by name. The ID is `camera-` or `lens-` and the name, made when the file is first saved.
- **`image`** is the picture's link in R2, or `""` to keep the drawing. **`description`** is up to 1000 characters, or
  `""`. A file needs one of them.

Saving or removing one (`PUT /api/gear/<id>` → `PUT /gear/{id}`, `DELETE /api/gear/<id>` → `DELETE /gear/{id}`) is a
[change waiting for Commit](pending-changes.md), counted by the sync button as a gear picture. Photos in Flight lists
the files under **Gear pictures**. Locally, `pnpm photos:local` also makes `GEAR.local.json`, which the portfolio uses
in place of the committed file.

## The picture

Choosing a picture (`POST /api/gear/image` → `POST /gear/image`, a multipart form with the file as `image`) uploads it
to R2 at once, like a photo, since the file only points at it. It can be a JPEG, PNG or WEBP of up to 20 MB. The
backend turns it upright, shrinks it to fit 800 × 800 and saves it as a WEBP at quality 90, keeping a PNG's or WEBP's
transparent background, under `gear/<hash>-<name>.webp`. The hash is of the WEBP itself, so a new picture always gets
a new link. Removing a file or picking another picture leaves the old one in R2.

## The page

The left lists every camera or lens (a tab for each) that the photos name, most photos first, with a picture mark on the
ones that have one, then any file for one no photo names any more. The right edits the chosen one: a preview as the
info pane will show it (the drawing until a picture is chosen), the picture to upload, **Use the drawing** to clear it,
and the description. **Save picture** (or **Save changes**) and **Remove picture** keep the file as a change waiting
for Commit. The pipeline's own Gallery shows the committed pictures, since it imports the portfolio's filters.
