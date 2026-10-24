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
An album file may also have `order`, its place among the albums (1 first), and `spotlightZones`, the spots on the
portfolio that show its photos, such as `["homepage"]`; see [Albums and Tags](albums-and-tags.md#order).
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

## Date taken

A photo's date is its EXIF `createDate` (as exiftool writes it, `"2016:12:23 22:07:39"`), or else `customCreateDate`,
written on the Photo page and in Edit Photo under **Title** as **Date taken → Custom date**. The custom one wins, and the
EXIF one is kept as it is. The portfolio leaves out photos with neither on every view (it orders and groups photos by
date), so a photo whose EXIF has no date, such as a phone photo saved by an app that strips it, needs a custom one to
show. The section starts open when the EXIF has no date. When the file name has the date in it, as phones write them
(`IMG_20161223_220739_041`, `PXL_20230101_123456789`, `Screenshot_2016-12-23-22-07-39`), it offers
**Use Dec 23, 2016, 10:07:39 PM from the file name** in one click. New photos get `"customCreateDate": null`, and
**Update Data → Missing fields** adds it to older ones. The pipeline's own checks, such as a duplicate photo's
`file`, `gpsPosition` and `createDate`, still use the EXIF date.

> **Frontend analogy:** like a `defaultValue` the user can override: `customCreateDate ?? createDate`, with the file
> name as a suggested value.

## Places, spotlights and posts

A photo's `places` list where it was taken, each a place ID and how the photo relates to it, and `LOCALIZATIONS.json`
notes how countries, cities and places are written and said; see [Places and Localizations](places-and-localizations.md).
`METAINFO.json` names groups of the photos' camera, lens, focal length, aperture, exposure and ISO values; see
[Metadata Groups](metadata-groups.md). `CAMERAS.json` holds per-camera rules that write other values over a photo's EXIF,
and a photo's `exifOriginals` keeps the EXIF values they replaced; see [Camera Overrides](camera-overrides.md).
`LENSES.json` holds the custom lenses a photo's `customLens` can name, and `manualAperture` marks a photo whose
aperture is manual or unknown; see [Custom Lenses](custom-lenses.md).

A photo's `spotlightZones` and `websiteSpotlight` are left from when spotlight zones listed photos. The zones list
albums instead (see [Publish](publish.md#site-spotlight)), and the photos that were on the homepage were moved into the
**Homepage Spotlight** album, which the Homepage zone shows. `websiteSpotlight` still puts those photos first in an
album, in their old order; `spotlightZones` isn't read.

A photo's `socialPosts` lists its posts on social media, each with its platform, status, date, link, caption and
hashtags; see [Publish](publish.md#social-media-posts). Older files may be missing it, which means none.

A photo's `reEdit` marks it to edit again, with a reason and the day it was marked, or is `null`; see
[Re-editing a photo](replace-image.md).

A photo's `colors` is its color summary, as the EXIF page's Colors tab shows it: the `average` color (hex, CIELAB and
HCL), the share of the photo in each of 12 hue `buckets`, the `neutrals` (blacks, grays and whites) by lightness, and
the mean `lightness` and `chroma`, and `peakChroma`, the chroma the most vivid tenth of its pixels reach (the 90th
percentile), so a muted photo with a small vivid part still scores high. New photos get it when they're saved after uploading to R2 (see [Saving photo data to GitHub](saving-to-github.md)), and older files once Update Data's **Colors** has read it; see
[Update Data](update-data.md).

> **Frontend analogy:** it's a normalized store, like a Redux slice keyed by ID: photos hold only the IDs of their
> albums and tags, and each album or tag is stored once, so renaming one later changes a single file.
