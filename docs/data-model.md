# Photo, album and tag data

The portfolio's data lives in `apps/portfolio/src/data` (the **Data folder** in Settings), one JSON file per thing:

| What   | File                      | Combined by **Commit** into |
| ------ | ------------------------- | --------------------------- |
| Photos | `photos/<PHOTONAME>.json` | `photos/ALLPHOTOS.json`     |
| Albums | `albums/<ALBUM_ID>.json`  | `albums/ALLALBUMS.json`     |
| Tags   | `tags/<TAG_ID>.json`      | `tags/ALLTAGS.json`         |

A photo can have several tags and is usually in one album (more is allowed, but the pipeline warns), and an album or
tag can have many photos: each photo JSON has `albums` and `tags` keys, arrays of album and tag IDs. A tag file is
`{ "id", "name", "description" }` and an album file `{ "id", "name", "description", "parent" }`, each named by its ID.
An album's `parent` is the ID of the one album it sits inside, or `null` for a top-level album; the pipeline never
lets an album end up inside itself. Albums and tags share one set of IDs and names, compared ignoring case, so a
photo's `albums` and `tags` never mean the same thing.

> **Frontend analogy:** it's a normalized store, like a Redux slice keyed by ID: photos hold only the IDs of their
> albums and tags, and each album or tag is stored once, so renaming one later changes a single file.
