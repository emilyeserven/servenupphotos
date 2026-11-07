# EXIF in R2

The pipeline keeps a photo's details in its photo JSON, and some of them change after the photo is uploaded: a time
fixed by [Times across timezones](timezone-shift.md) goes into `customCreateDate`, a city typed on the Photo page into
`customCity`, a [camera override](camera-overrides.md) renames a lens. The original JPEG in R2 keeps the EXIF it was
uploaded with, so anyone downloading it, and Lightroom when it's imported again, sees the old values.

**Update Data → EXIF in R2** (`/update-data/r2-exif`) finds where the two differ. Each change is made in Lightroom
first, by hand, since the pipeline can't reach Lightroom's catalog; then it's ticked as **Done in Lightroom** and
written into the original in R2, one photo at a time. Lightroom is the source of truth, so no backup of the original
is kept: if a write goes wrong, export the photo from Lightroom again and swap it in with
[Replace image](replace-image.md).

> **Frontend analogy:** the photo JSON is your app state, Lightroom is the source file, and the JPEG in R2 is a build
> output. The check is a diff between state and output; you fix the source first, then patch the output to match, and
> a broken output never needs a backup because you can always rebuild it from the source.

## Checking

**Check the originals** (`POST /api/data/r2-exif/preview`, `PreviewR2Exif` in `github/r2exif.go`) reads every photo
file as the next Commit will have it, downloads each original at `images.key` (four at a time, with the same progress
bar as Colors) and reads its EXIF as Explore Bucket does. The EXIF is kept in memory by key, shared with Missing
fields, so checking again is quick. Photos without `images.key` aren't read.

For each field below it compares the value the pipeline shows (the custom one when there is one) with the EXIF's,
and lists the photo when any differ (`R2ExifMismatches`). A field the photo file has no value for isn't listed, as
there's nothing to write.

| Field        | Pipeline value                          | Written to (exiftool tags)                                         |
| ------------ | --------------------------------------- | ------------------------------------------------------------------ |
| Date taken   | `customCreateDate`, else `createDate`   | `DateTimeOriginal`, `CreateDate`                                   |
| GPS position | `customGpsPosition`, else `gpsPosition` | `GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef` |
| City         | `customCity`, else `city`               | `City`                                                             |
| State        | `customState`, else `state`             | `State`, `Province-State`                                          |
| Country      | `customCountry`, else `country`         | `Country`, `Country-PrimaryLocationName`                           |
| Camera       | `camera`                                | `Model`, `CameraProfilesUniqueCameraModel`                         |
| Lens         | `lens`                                  | `LensModel`, `Lens`, `CameraProfilesLens`                          |
| Aperture     | `aperture`                              | `FNumber`                                                          |
| Exposure     | `exposure`                              | `ExposureTime`                                                     |
| ISO          | `iso`                                   | `ISO`                                                              |
| Focal length | `focalLength`                           | `FocalLength`                                                      |

Dates compare by their first 19 characters (so a fraction of a second or an offset on the EXIF's is ignored), GPS
positions within about 10 m, and numbers by value. Each field says where its value came from: **custom value** (written
on the Photo page or by Times across timezones) or **camera override or custom lens** (the field is in `exifOriginals`).
The camera and lens are written to Lightroom's own `CameraProfiles…` tags too, because the pipeline reads those first.
A tag named without a group is changed in every group the file already has it in (IPTC and XMP `City`, say) and
created in exiftool's preferred one.

The list can be filtered to **Doesn't match R2** and **To do in Lightroom**. A photo whose original couldn't be read
says why.

## Writing

Every field starts unticked. Make the change in Lightroom, then tick the field's **Done in Lightroom** box; only
ticked fields are written. Each shows the value it will write, which can be changed first to match what Lightroom has.
**Write N fields to R2…** opens a confirm step listing them, and only **Overwrite in R2** there writes anything
(`POST /api/data/r2-exif/write` with `"confirm": true` and `"lightroom": true` on each field; the backend refuses the
request without them). The backend then (`handleWriteR2Exif` in `httpapi/r2exif.go`):

1. Reads the photo file for its `images.key`, and checks each value (`exif.EditTags`: a date as `2016:12:24 06:07:39`,
   a GPS position as `40.7795, -73.9634` or as exiftool writes it, numbers above 0).
2. Downloads the original to a temp file, reads its EXIF, writes the tags with the running exiftool, and reads it
   again. If any field doesn't read back as written, it stops there and R2 is left as it was.
3. Uploads the edited file over the original at the same key (`storage.ReplaceOriginal`), with no backup. The key, and
   the hash in it, stay, so every link keeps working; the resized versions and the Square Thumbnail aren't touched, as
   EXIF doesn't change the pixels. If the upload fails, the answer says to export the photo from Lightroom again and
   use Replace image.
4. Notes the edit in the photo file's `r2ExifEdits` as a [change waiting for Commit](pending-changes.md): when, and
   each field's value before and after. If that save fails, the answer says the original was already changed.

```json
"r2ExifEdits": [
  {
    "date": "2026-11-07T15:30:00Z",
    "fields": [
      { "field": "createDate", "from": "2016:12:23 22:07:39", "to": "2016:12:24 06:07:39" }
    ]
  }
]
```

Cloudflare's CDN may keep serving the old file at `cdn.servenupphotos.net` until its cache expires.

> **Frontend analogy:** the confirm step is a `window.confirm()` you can't skip from devtools: the server also checks
> for the flags, like a `DELETE` that needs a `?confirm=true`. Steps 2 and 3 write to a scratch copy and re-read it
> before swapping it in, like running the tests before you deploy.

Each photo lists its earlier writes under **Written to R2**, and **Written before** filters the list to them.

`r2ExifEdits` isn't one of the fields Missing fields adds, and the portfolio's build leaves it out with the
photographer's notes (`apps/portfolio/private-notes.ts`).

The work is in `exif/edit.go` (tags, checking values, comparing), `github/r2exif.go` (the check and the notes),
`storage/replace.go` (the overwrite) and `httpapi/r2exif.go`; the page is in `components/r2-exif/`.
