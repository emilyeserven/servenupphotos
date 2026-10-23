# Camera Overrides

`/camera-overrides`, under **Configuration** in the sidebar, sets what to write instead of a camera's EXIF values, such
as `"Fujifilm X-T5"` for a camera whose EXIF says `"X-T5"`, or a lens's real name for an adapted manual lens whose EXIF
only says `"21.0 mm"`. Rules are per camera and can set any field read from EXIF: `camera`, `lens`, `focalLength`,
`aperture`, `exposure`, `iso`, `gpsPosition`, `createDate`, `country` and `city`.

## The file

Each camera's rules are one file, `cameras/<id>.json`, and **Commit** combines them into `cameras/CAMERAS.json` the
way it combines metadata groups into `METAINFO.json`. Saving or removing one is a [change waiting for
Commit](pending-changes.md), counted by the sync button as a camera override.

```json
{
  "id": "x-t5",
  "camera": "X-T5",
  "rules": [
    { "when": null, "set": { "camera": "Fujifilm X-T5" } },
    {
      "when": { "field": "lens", "value": "21.0 mm" },
      "set": { "lens": "7Artisans 21mm F1.4", "aperture": 1.4 }
    }
  ]
}
```

- **`camera`** is the camera exactly as the photos' EXIF names it (what the pipeline reads before any override). Only
  one override can be for a camera. The ID is made from it when the override is first saved.
- **`rules`** apply in order. A rule with `when: null` is for every photo from the camera; one with a `when` is only for
  the photos whose EXIF has that value of that field (`null` for photos without one). A later rule's value for a field
  wins.
- **`set`** is the fields the rule writes and their values, each of the type the photo files have: text for the camera,
  lens, exposure, GPS position, date, country and city, numbers for the focal length, aperture and ISO (ISO a whole
  number), or `null` to clear it.

`when` is always checked against the photo's EXIF values, never against what an earlier rule wrote, so the rules for a
camera don't depend on each other's order except where two set the same field.

## What the photos keep

A photo whose fields an override changed keeps the EXIF values it replaced in `exifOriginals`, such as
`{ "camera": "X-T5", "lens": "21.0 mm", "aperture": null }`; it's `{}` when nothing was overridden. That's what lets
the rules be applied again after they change: the EXIF values are each field's value with `exifOriginals` laid over
it, and a field no rule sets any more goes back to its EXIF value. Files from before it have no `exifOriginals`, which
reads as `{}` (their fields are still their EXIF values); Update Data's **Missing fields** adds it.

> **Frontend analogy:** it's like keeping a form's `defaultValues` next to its edited values. The overrides are a
> derived layer (`{ ...exif, ...rules }`), and keeping the originals means you can recompute that layer whenever the
> rules change instead of editing an already-edited value.

## Where they apply

- **New photos.** Reading a photo's EXIF (`POST /exif` on the Photo page and Bulk Upload, `POST /photos/bucket/exif`
  in Explore Bucket) makes the overrides, as the next Commit will have them, over its sanitized EXIF, so the preview
  and the saved JSON already have them. When GitHub isn't set up or can't be read, the photo keeps its EXIF values. The
  full `exif` the endpoint returns is never changed.
- **Update Data → Camera overrides** (`POST /data/camera-overrides/preview`, then `POST /data/camera-overrides`) lists,
  for every photo file, the fields applying the overrides again would change, then saves them as changes waiting for
  Commit. Only those fields change, so the rest of each file keeps its formatting. A file without `exifOriginals` only
  gets it when an override changes something.
- **The Photo page**, editing a saved photo, has a **Camera overrides** card listing what the overrides would change in
  its JSON. **Apply overrides** puts those changes into the edit, and **Save changes** writes them with the rest.

Metadata groups and the portfolio's Camera and Lens filters use the values as the photo files have them, so after
renaming a camera or lens here, add the new name to its [metadata groups](metadata-groups.md) (and drop the old one).

## The page

The left lists every camera the photos' EXIF names, with how many photos and rules it has. The right edits the chosen
camera's rules: **For** picks every photo from the camera or the photos with one EXIF value of a field (offering the
values its photos have, with their counts), and each **Set** row picks a field and the value to write. A new override
starts with a rule setting the camera to its EXIF name, to be renamed. The note under the rules says how many of the
camera's saved photos the rules, as written, would change.

**Original EXIF** reads every tag of one of the camera's originals in R2 (`POST /photos/bucket/exif`), such as `Make`,
`LensMake`, `LensModel`, `LensInfo` or `FocalLengthIn35mmFormat`, which the photo data doesn't keep. It shows the camera,
lens and settings tags unless asked for all of them. **Use for** adds a rule writing that tag's value into a field: for
the camera's name, for every photo from the camera; for anything else, for the photos with the chosen photo's EXIF
lens. A number field takes the first number in the value (`"21.0 mm"` is 21).
