# Photo Sets

A Photo Set is a few photos the [portfolio map](portfolio-map.md) always shows as one marker, however far in or out it's zoomed, such as a walk down one street or a series shot in one spot. Other photos split apart as the map zooms in and group together as it zooms out; a set's photos never do.

## On the map

A set's marker is its first photo's square pin with a second square stacked behind it, up and to the right, showing the set's next photo, plus a small badge with how many photos it has (hidden by **Show counts** in the map's display options). It sits in the middle of its photos, never joins a group, and is spaced from the markers around it like any other. Clicking it opens the set's photos in a grid, the same popup (or sheet along the bottom on phones) that a group opens, titled with the set's name; each photo there opens the photo viewer, which steps through the set.

The map's filters still apply: the marker stands for the set's photos the filters leave. With fewer than two of them left (or fewer than two the map can place), there's no set marker, and a photo left over is drawn on its own. The map's **Key** lists **Photo Set** whenever a set is drawn.

> **Frontend analogy:** the map hands MapLibre every photo but the sets' to group, like keeping pinned rows out of a virtualized list, and draws each set as one extra marker of its own (`splitSets` in `lib/map-sets.ts`).

## Making and editing sets

The pipeline's **Photo Sets** page (`/photo-sets`, under **Organize** in the sidebar):

- **New set** asks for a name and makes the set, empty. The dropdown picks the set to edit (`?set=<id>` in the URL), showing how many photos each has, and **Remove set** removes it after asking; its photos stay as they are.
- The set's **Name** is the popup's title on the map.
- Its photos are tiles in order. The first, marked **on marker**, is the one its marker shows, and the second is the one stacked behind it. Drag tiles into order or use each one's arrows, and the × takes a photo out. A photo the map can't place (no GPS position, custom one or place) is marked **Not on the map**.
- The **Photos** drawer on the right lists the photos (with the Grid's filters and a search), as on the Photo Book and Bio pages: click one, or drag it onto the set, to add it at the end. Photos already in a set are hidden unless **Show photos already in a set** is ticked.
- A photo can be in one set only. Adding one that's in another set says which, and the backend refuses it too (`409`), so take it out of that set first.

Each change is saved shortly after the last one as a change waiting for Commit (see [Changes waiting for Commit](pending-changes.md)). Each set is `sets/<id>.json`:

```json
{ "id": "brussels-walk", "name": "Brussels walk", "photos": [297, 298, 299, 300] }
```

`photos` are the photos' IDs, in order. Commit combines the files into `sets/SETS.json`, which the portfolio reads (`lib/photo-sets.ts`); `pnpm photos:local` makes `SETS.local.json` from them like the other kinds.

The backend saves and removes them with `PUT /api/sets/{id}` and `DELETE /api/sets/{id}` (`internal/github/photosets.go`), checking the name, that each photo ID is listed once, and that no photo is in another set.
