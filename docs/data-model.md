# Photo, album and tag data

The portfolio's data lives in `apps/portfolio/src/data` (the **Data folder** in Settings), one JSON file per thing:

| What             | File                      | Combined by **Commit** into        |
| ---------------- | ------------------------- | ---------------------------------- |
| Photos           | `photos/<PHOTONAME>.json` | `photos/ALLPHOTOS.json`            |
| Albums           | `albums/<ALBUM_ID>.json`  | `albums/ALLALBUMS.json`            |
| Tags             | `tags/<TAG_ID>.json`      | `tags/ALLTAGS.json`                |
| Places           | `places/<PLACE_ID>.json`  | `places/PLACES.json`               |
| Localizations    | `localizations/<ID>.json` | `localizations/LOCALIZATIONS.json` |
| Metadata groups  | `metainfo/<ID>.json`      | `metainfo/METAINFO.json`           |
| Camera overrides | `cameras/<ID>.json`       | `cameras/CAMERAS.json`             |
| Custom lenses    | `lenses/<ID>.json`        | `lenses/LENSES.json`               |

A photo can have several tags and is usually in one album (more is allowed, but the pipeline warns), and an album or
tag can have many photos: each photo JSON has `albums` and `tags` keys, arrays of album and tag IDs. A tag file is
`{ "id", "name", "description" }` and an album file `{ "id", "name", "description", "parent" }`, each named by its ID.
An album's `parent` is the ID of the one album it sits inside, or `null` for a top-level album; the pipeline never
lets an album end up inside itself. Albums and tags share one set of IDs and names, compared ignoring case, so a
photo's `albums` and `tags` never mean the same thing.

## Photo IDs

Each photo JSON starts with an `id`: a whole number, unique among the photos, which the portfolio's links use to open a
photo (`/grid?photo=12`). A new photo gets one more than the highest ID in the photo files as the next Commit will have
them, pending changes included. Older files without one get theirs from **Missing fields** on
[Update Data](update-data.md), counting up from the highest ID in the order the files were created. Until then the
portfolio numbers them after the highest ID by their place in `ALLPHOTOS.json`, which changes as photos are added, so
links to them don't last.

## Places, spotlights and posts

A photo's `places` list where it was taken, each a place ID and how the photo relates to it, and `LOCALIZATIONS.json`
notes how countries, cities and places are written and said; see [Places and Localizations](places-and-localizations.md).
`METAINFO.json` names groups of the photos' camera, lens, focal length, aperture, exposure and ISO values; see
[Metadata Groups](metadata-groups.md). `CAMERAS.json` holds per-camera rules that write other values over a photo's EXIF,
and a photo's `exifOriginals` keeps the EXIF values they replaced; see [Camera Overrides](camera-overrides.md).
`LENSES.json` holds the custom lenses a photo's `customLens` can name, and `manualAperture` marks a photo whose
aperture is manual or unknown; see [Custom Lenses](custom-lenses.md).

A photo's `spotlightZones` lists the spots on the portfolio it's spotlighted in, by ID, such as `"homepage"`; see
[Publish](publish.md#site-spotlight). Older files may be missing it, which means none.

A photo's `socialPosts` lists its posts on social media, each with its platform, status, date, link, caption and
hashtags; see [Publish](publish.md#social-media-posts). Older files may be missing it, which means none.

A photo's `reEdit` marks it to edit again, with a reason and the day it was marked, or is `null`; see
[Re-editing a photo](replace-image.md).

A photo's `colors` is its color analysis, as the EXIF page's Colors and Raw color data tabs show it: the `average` color (hex, CIELAB and
HCL), the share of the photo in each of 12 hue `buckets`, the `neutrals` (blacks, grays and whites) by lightness, and
the mean `lightness` and `chroma`, and the `raw` per-color-space statistics. New photos get it when they're saved after uploading to R2 (see [Saving photo data to GitHub](saving-to-github.md)), and older files once Update Data's **Colors** has read it; see
[Update Data](update-data.md).

> **Frontend analogy:** it's a normalized store, like a Redux slice keyed by ID: photos hold only the IDs of their
> albums and tags, and each album or tag is stored once, so renaming one later changes a single file.
