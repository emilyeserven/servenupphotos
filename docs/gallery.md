# Gallery

`/gallery` shows the photos already in the portfolio: every photo `.json` on the base branch (`GET /api/photos/published`
→ `GET /photos/published`), newest first, as Square Thumbnail tiles (from the [offline copy](offline-mode.md)) with their title and file name, filterable by
either and by the same **Title**, **Place**, **GPS position**, **Albums**, **Tags**, **Genres** and **Re-edit mark** filters as
[Photos in Flight](photos-in-flight.md#filters), kept in the URL too. [Undecided](photos-in-flight.md#undecided) photos are hidden
until the **Undecided** filter is changed from **Hidden** to **Shown** (with the rest) or **Only** (`?undecided=show` or
`?undecided=only`); the count under the filters says how many are shown while any are hidden. **Sort** beside it
switches from **Date taken** (newest first) to **Date added** (`?sort=added`): the photos most recently added to the
portfolio first, by their [`addedDate`](data-model.md#date-added), then the ones without one by when they were taken. **Time of day** (`?sort=time`) orders them by the time of day they were taken, from just after midnight to just before, by the clock where they were taken (the custom date, or else the EXIF date), with photos that have no date at the end. Photos the open **Add photo data** pull request changes are marked "Changes in flight" (or "Removed in flight"),
linked to Photos in Flight. A photo with no title on the base branch is a [draft](drafts.md), listed here but marked
**Draft**, since `ALLPHOTOS.json` leaves it out. The list is read from the photos folder rather than `ALLPHOTOS.json`, since editing needs
each photo's file path, which `ALLPHOTOS.json` entries don't carry.

### A place's photos

On the [Places page](places-and-localizations.md#places), a place's photo count and **See photos in Gallery** at the
top of its panel open the Gallery showing only the photos that list that place (`?placeId=<id>`). The filter bar then
shows the place, with an × that shows every photo again, and a **Coordinates** filter for where each of its photos
goes on the portfolio's map (`?placeGps=`):

- **Own** (`own`): the photo has its own GPS position, its custom one or its EXIF one, so it's placed exactly.
- **From a place** (`place`): it has none, so it inherits the position of its first place that has one (or a place
  that place is in), the way the portfolio's map picks it.
- **None** (`none`): neither it nor any of its places has a position, so it isn't on the map.

While a place is chosen, each tile says which: a green **Own GPS position**, a blue **GPS from Mill River Park**
(with "(exact location)" when that place is marked as one), or an amber **Not on the map**. **Clear filters** clears
the place too. The count can be lower than the Places page's, since the Gallery lists only the photos already on the
base branch and hides Undecided ones until shown.

> **Frontend analogy:** the tile marks are like DevTools' computed styles showing whether a value is set on the
> element itself or inherited from a parent: `customGpsPosition ?? gpsPosition ?? place.gps`.

Each photo with its image in R2 has an **Edit** button that opens it on the Photo page (`/exif?edit=<path>&from=gallery`),
the same editor Photos in Flight uses, and each tile lists the photo's album, tag and genre names. Saving keeps the JSON as a
[change waiting for Commit](pending-changes.md), which Commit sends to the open pull request (the branch must already
have the file; update it from the base branch if it was made before the photo merged), or to a new one when none is
open. From then on the photo is in Photos in Flight, and edits go to that copy, whether or not a pull request is open yet. A new title doesn't rename the file, since the pull request would then delete
the old file from the portfolio when it merges and the photo's file name would change under it.

**Select** turns on choosing photos, with a checkbox on each tile (or click the tile), **Select all shown** for the
filtered ones, and an **Add albums, tags and genres** card with an album, a tag and a genre combobox. **Add to N photos**
(`POST /api/photos/groups` with `paths`, `albums`, `tags` and `genres`) adds them to each chosen photo's `albums`, `tags` and `genres`
after the ones it has, changing nothing else in the files, as [changes waiting for Commit](pending-changes.md), the
way Update Data saves. It warns when a chosen photo is already in another album.
