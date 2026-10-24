# Metadata Groups

`/metadata-groups`, under **Configuration** in the sidebar, names groups of the photos' metadata values: cameras,
lenses, focal lengths, apertures, exposures and ISO. A group can gather a range, such as **Wide angle** for focal
lengths 10 to 24 mm, or every way EXIF spells one thing, such as the two names Canon's 18-135mm kit lens shows up
under, and groups can sit inside other groups. The portfolio Grid's [filters](portfolio-filters.md#metadata-groups)
list them. The **Lenses** tab also holds the [custom lenses](custom-lenses.md), under the lens groups.

## The file

Each group is one file, `metainfo/<id>.json`, and **Commit** combines them into `metainfo/METAINFO.json` the way it
combines places into `PLACES.json`. A camera or lens group lists its values; a focal length, aperture, exposure or ISO
group is a range:

```json
{
  "id": "lens-zoom",
  "name": "Zoom",
  "description": "",
  "field": "lens",
  "parent": "lens-types",
  "order": 0,
  "values": ["EF-S18-135mm f/3.5-5.6 IS STM", "XF18-135mmF3.5-5.6R LM OIS WR"]
}
```

```json
{
  "id": "focal-length-wide-angle",
  "name": "Wide angle",
  "description": "",
  "field": "focalLength",
  "parent": "",
  "order": 0,
  "values": [],
  "range": { "min": 10, "max": 24 }
}
```

`field` is the photo JSON key the group is of: `camera`, `lens`, `focalLength`, `aperture`, `exposure` or `iso`.

- **`values`** are written exactly as the photo files have them, so matching a photo to a camera or lens group is a
  plain equality check. A value can be in more than one group.
- **`range`** covers every value from `min` to `max`, both ends included, so a photo taken later at 15 mm is in
  **Wide angle** without editing the group. Each value is read as a number: focal lengths in mm, apertures as
  f-numbers, ISO as is, and exposures in seconds (`"1/250"` is 0.004, `"2"` is 2). Text with a number in it reads as
  its first number (`"24 mm"` is 24). Either end can be left out for a range open on that side: `{ "min": 12800 }`
  is every ISO from 12800 up, and `{ "max": 0.004 }` every exposure of 1/250 s or faster. A range needs at least
  one end. Only those four fields can have a range, and `min` can't be above `max`.
- **`parent`** is the ID of the group of the same field this one is in, or `""`. Groups nest as deep as needed, such
  as **Brands** holding **Canon** and **Fujifilm** while **Types** holds **Zoom** and **Prime**. A group covers its
  own values or range and those of every group in it. A group can't be in itself or in a group that's in it, and a
  group with groups in it can't be removed until they're moved out or removed.

- **`order`** is where the group goes among the groups with the same parent (or among the top-level groups): lowest
  first, and groups with the same order by name. It's a whole number, 0 or more; files from before it was added
  have none, which reads as 0. A new group, or one moved into another parent, goes after the groups already there.

The ID is the field and the name as an ID (`lens-zoom`), made when the group is first saved and kept when it's
renamed or moved. Two groups of the same field can't share a name, ignoring case.

> **Frontend analogy:** a group is like a saved filter preset, `{ key: "focalLength", gte: 10, lte: 24 }` or
> `{ key: "lens", in: [...] }`, kept as data so any view can apply it later; `parent` nests presets like folders.

## The page

A tab for each field shows how many groups it has. Each tab lists its groups on the left as a tree in their saved
order, each group under the one it's in, with what it covers (a range such as **10–24 mm**, or how many values or groups it has) and how many
photos have a value it or a group in it covers. The right side edits the chosen group, or a new one after **New
group** (on a phone, the list comes first). **In** puts the group inside another of its field; it doesn't offer the
group itself or a group in it. The arrows at the end of each row move it one place up or down among the groups in the
same parent; that saves the new `order` of every group whose place changed, each as its own change waiting for
Commit.

The photos are `ALLPHOTOS.json` at the photo data pull request's head with the changes waiting for Commit (the
[combined data store](combined-data-store.md)).

**Focal lengths, apertures, exposures and ISO** get a **Range** slider with a handle for each end, sorted by number
(exposures from fastest to slowest). It stops at each value the photos have, marked with a tick under the track, and
also at the field's common values a stop or so apart, so a range can reach past what the photos have: focal lengths
8 to 800 mm, apertures f/1 to f/32, exposures 1/8000 s to 30 s, and ISO 50 to 102400. The boxes under it set either
end by typing, to any value at all (`1/16000` for an exposure). **No lowest** and **No highest** leave that end
open: its box and handle go away, the range runs off that end of the slider, and it shows as **ISO 12800 and up** or
**up to 1/250 s**. Unticking one puts that end back at the slider's last stop that way. The values the photos have inside the range are
listed under it with their photo counts. A new group starts as every value the photos have.

Each tab's list ends with the values the photos have that **no group** covers, as dashed chips with their photo
counts (or a note that every one is in a group). A group with subgroups does the same for its own scope: its row says
how many of its values are **not in subgroups**, and its editor lists them. Its scope is its own values or range, or,
when it only holds groups, every value the photos have; a value counts as covered when any group under it, however
deep, has it. So **Types** holding only **Zoom** shows the prime lenses as not in its subgroups.

> **Frontend analogy:** it's an exhaustiveness check, like TypeScript flagging the `switch` cases a union still has
> no `case` for.

**Cameras and lenses** get **Values**, a checkbox for every value the photos have, sorted by name, each with how many
photos have it. In a group that's inside another, a value one of its sibling groups (the other groups in the same
parent) already lists says **Also in …** under it, and can still be checked here; so **Canon** and **Fujifilm** under
**Brands** flag a shared lens, but **Canon** and **Zoom**, in separate trees, don't. A top-level group shows no such
notes. A
value only a group lists, with 0 photos, stays in the list so it can be unchecked. **Add** puts in a value no photo
has yet, typed as EXIF writes it.

**Save group** or **Save changes** (`PUT /api/metainfo/<id>` → `PUT /metainfo/{id}`) and **Remove group**
(`DELETE /api/metainfo/<id>` → `DELETE /metainfo/{id}`) keep the file as a [change waiting for
Commit](pending-changes.md), counted by the sync button as a metadata group. The page reads the groups from the
combined data store's `METAINFO.json` with those changes made over it, so a saved group shows at once. Photos in
Flight lists the group files with the others.
