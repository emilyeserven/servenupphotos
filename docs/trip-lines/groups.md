# Groups

A day often holds several outings, such as three parks. The photo strip splits the day into groups, each its own line with a name:

- Every day shows its groups from the start, whatever its line: a day with no line or an automatic one is grouped by their [place](../places-and-localizations.md) over the line it shows. A group starts wherever the first place of a photo changes, named after it, and a photo with no place stays in the group before it. Changing anything in the strip (a gap, a name, a split) starts a hand-drawn line from what was shown, as picking **By hand** would; nothing is saved until **Save route**.
- Clicking a photo opens it on the Photo page in a new tab (`/exif?photo=<id>`, which finds the photo's file in the pull request or else on the base branch), to change its Place or anything else. Reload the Trip Lines page after saving it there to see the groups follow the new Place.
- Each group's header has its name, how many photos it has, a button that collapses it to the header, and an eye that shows that group alone on the map, the others faded.
- The shapes button on a group's header edits the area of the group's place (the place of its first photo), the same area as the place's own page: find one by name or Wikidata ID, or remove it. It's light blue when the place has one, and the day's map shades the areas of every place on the day. A place with no area but with a GPS position gets a dashed circle 80 m around its position instead (`circleShape` in `portfolio/src/lib/place-circle.ts`), so it reads as the place's surroundings rather than one more pin. For a single building, finding it by name gives its footprint as the area when OpenStreetMap maps its outline.
- Each photo shows its number on the map before the time it was taken, such as **3 · 14:59**.
- Pointing at a photo shows arrows that move it one place earlier or later in the day, for a camera whose clock was off. The new order is saved with the line as `order`, and the map's numbers and line follow it. A photo added to the day since goes after the photo taken just before it.
- The plus under the menu between two photos has **Start a new group here**, which starts a new group at the photo after it. The join button between two groups merges them. The menu between two groups picks what happened between them, like any gap.
- When that is a **Break**, an **End** and a **Start** chip under it give each group its own ends, such as back to the hotel for lunch and out from it again (`components/trip-lines/break-spots.tsx`). Each picks a spot with no photo on the map, then labels or removes it, like the day's Start and End. The line before the break runs on to its end spot, and the line after starts from its start spot, so even a group of one photo gets a line. They're saved as that segment's `end` and the next one's `start` (the draft's `breakEnds` and `breakStarts`, by the photo beside them, in `lib/break-ends.ts`), and kept while the gap is switched away from a break and back.
- The shuffle button on a group's header marks it as an [area wandered](#areas-wandered).

Saving writes each group's name on its segments, and a walk crossing from one group into the next is split there, so the stretch between the two groups is its own unnamed segment. Opening a saved line rebuilds the groups from those names. A line saved with no names is grouped by place again, and a group left unnamed isn't kept.

> **Frontend analogy:** groups are like `<details>` sections over one list: they change how the list is shown and labeled, but the photos and gaps underneath stay one array.

## Areas wandered

For a hike or an afternoon wandering a park with no set route, the shuffle button on a group's header makes every gap inside it **Wandered the area** (`wander`), and pressing it again walks through the photos again. No line is drawn through a wandered group's photos; the map shades the place's area, or circles it, instead. Under the map, **Areas wandered** lists them, each with **Entrance on the map** and **Exit on the map**: click the spot where the day entered and left the area, such as a park's gates. They're kept for that day only. The line from the photo before then runs to the entrance, and the line to the next photo from the exit, instead of to and from the photos inside (`lib/trip-wander.ts`, `components/trip-lines/area-ends.tsx`).

They're saved on the segments around the area: `to` on the one coming in (by the area's first photo) and `from` on the one going out (by its last). Commit bakes those segments through them (`areaEnd` in `triplines_route.go`), snapping to streets follows them too, and a `wander` segment bakes no line at all.

> **Frontend analogy:** like `position: absolute` children inside a box: the photos still belong to the group, but the line only connects the box's doors.
