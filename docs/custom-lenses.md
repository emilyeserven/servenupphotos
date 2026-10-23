# Custom Lenses

Custom lenses are lenses the photos' EXIF doesn't name well, such as a manual lens adapted to the camera, whose EXIF
only says `"21.0 mm"` or nothing at all. They're added on the **Lenses** tab of [Metadata Groups](metadata-groups.md),
under the lens groups, and picked for a photo on the Photo page. A photo given one gets its name as its `lens`, and its
focal length and aperture.

## The file

Each lens is one file, `lenses/<id>.json`, and **Commit** combines them into `lenses/LENSES.json` the way it combines
camera overrides into `CAMERAS.json`. Saving or removing one (`PUT /api/lenses/<id>` → `PUT /lenses/{id}`,
`DELETE /api/lenses/<id>` → `DELETE /lenses/{id}`) is a [change waiting for Commit](pending-changes.md), counted by the
sync button as a custom lens file.

```json
{
  "id": "7artisans-12mm-f2-8",
  "name": "7Artisans 12mm F2.8",
  "description": "Manual focus, adapted to the X-T5.",
  "focalLength": 12,
  "aperture": null,
  "manualAperture": true
}
```

- **`name`** is what the photos get as their `lens`. Two lenses can't share a name, ignoring case. The ID is made from
  it when the lens is first saved, and kept after that.
- **`focalLength`** (mm) and **`aperture`** (f-number) are numbers above 0, or `null` to leave the photo's own.
- **`manualAperture`** is for a lens whose aperture is set by hand on the lens, so the camera never knows it: its
  photos get `"aperture": null` and `"manualAperture": true`. A lens with it has no `aperture`.

## The photo

A photo keeps the lens chosen for it as `customLens`, the lens's ID, or `null`. The lens's fields are made over the
photo's EXIF values right after the [camera overrides](camera-overrides.md), so they win over a rule that sets the
same field, and the EXIF values they replace are kept in `exifOriginals` the same way. That's why Update Data's
**Camera overrides** keeps a photo's lens: it applies the camera overrides and then the photo's custom lens. After a
lens is changed, the same button brings its photos up to date; after it's removed, its photos go back to their EXIF
lens (their `customLens` stays, naming a lens that's gone, and the Photo page shows it as removed).

> **Frontend analogy:** `customLens` is a foreign key, like a `categoryId` on a product. The photo stores the ID, and
> the lens's fields are joined in when the photo's JSON is worked out, so changing the lens once changes every photo
> that points at it.

The Photo page's **Lens** card, for a new photo and for a saved one, picks the lens (or **As the EXIF and camera
overrides say**) and lists what it writes. For a saved photo, picking another lens also applies the camera overrides,
as Update Data would, and **Save changes** writes both.

## Manual or unknown aperture

`manualAperture: true` with `"aperture": null` means the photo's aperture was set on the lens or isn't known. It comes
from a custom lens, from a camera override rule (**Manual/unknown aperture** is one of the fields a rule can set), or
from the **Manual/unknown aperture** box on the Lens card, which writes it straight into the photo's JSON. Files from
before it have no `manualAperture`, which reads as `false`; Update Data's **Missing fields** adds it, with
`customLens`.

The portfolio shows **Manual/unknown aperture** where it would show `f/2.8`: in the lightbox, the technical info line
and the Table's Aperture column. Since the aperture itself is `null`, the Aperture range filter and aperture
metadata groups leave those photos out, as they do photos whose EXIF has no aperture.
