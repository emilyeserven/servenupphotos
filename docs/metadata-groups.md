# Metadata Groups

`/metadata-groups`, under **Configuration** in the sidebar, names groups of the photos' metadata values: cameras,
lenses, focal lengths, apertures, exposures and ISO. A group can gather a range, such as **Wide angle** for focal
lengths 10 to 24 mm, or every way EXIF spells one thing, such as the two names Canon's 18-135mm kit lens shows up
under. Nothing reads them yet: the portfolio doesn't change, and a later change can use them for filters or labels.

## The file

Each group is one file, `metainfo/<id>.json`, and **Commit** combines them into `metainfo/METAINFO.json` the way it
combines places into `PLACES.json`:

```json
{
  "id": "focal-length-wide-angle",
  "name": "Wide angle",
  "description": "",
  "field": "focalLength",
  "values": [10, 11, 14, 18, 24]
}
```

`field` is the photo JSON key the values are of: `camera`, `lens`, `focalLength`, `aperture`, `exposure` or `iso`.
`values` are written exactly as the photo files have them, numbers for focal length, aperture and ISO and strings for
the rest (an exposure is a string such as `"1/250"`), so matching a photo to its groups is a plain equality check. A
value can be in more than one group. The ID is the field and the name as an ID (`lens-canon-ef-s-18-135mm`), made
when the group is first saved and kept when it's renamed. Two groups of the same field can't share a name, ignoring
case.

> **Frontend analogy:** a group is like a saved filter preset, `{ key: "focalLength", in: [10, 11, 14] }`, kept as
> data so any view can apply it later.

## The page

A tab for each field shows how many groups it has. Each tab lists its groups on the left, with how many values each
has and how many photos have one of them, and edits the chosen group, or a new one after **New group**, on the right
(on a phone, the list comes first).

**Values** is a checkbox for every value the photos have, sorted (numbers and exposures from smallest to largest,
names A to Z), each with how many photos have it. The photos are `ALLPHOTOS.json` at the photo data pull request's
head with the changes waiting for Commit (the [combined data store](combined-data-store.md)). A value only a group
lists, with 0 photos, stays in the list so it can be unchecked. For focal length, aperture and ISO, **Check every …
from … to …** checks every value in that range at once. **Add** puts in a value no photo has yet, typed as EXIF writes
it.

**Save group** or **Save changes** (`PUT /api/metainfo/<id>` → `PUT /metainfo/{id}`) and **Remove group**
(`DELETE /api/metainfo/<id>` → `DELETE /metainfo/{id}`) keep the file as a [change waiting for
Commit](pending-changes.md), counted by the sync button as a metadata group. The page reads the groups from the
combined data store's `METAINFO.json` with those changes made over it, so a saved group shows at once. Photos in
Flight lists the group files with the others.
