# Trips

`/trips`, under **Configuration** in the sidebar, names runs of days, such as **Korea** for September 20 to 21, 2026
and **Japan** for September 22 to October 2, and adds the legs travelled between those days, such as the ferry from
Busan to Fukuoka. One Trip does three jobs on the portfolio:

- The [Timeline](portfolio-timeline.md) shows each day's Trip beside the date in the day's heading, which sticks just
  under the month's heading. So while September 2026's Japan days scroll past, the top of the list reads
  **September 2026** with **Japan** beside the date under it, and it switches to **Korea** once the Korea days reach
  the top. Pointing at the Timeline's scrubber shows the Trip of the days there under the month in its bubble.
- The [map](portfolio-map.md) draws its legs between days, which a day's [trip line](trip-lines.md) can't hold, since
  a line can't cross midnight.
- The days' [stories](trip-pages.md) make up its Trip page, under **Albums**.

A [Smart Album](smart-albums.md) can also take its photos from a Trip's days.

Trips and timeline labels used to be two things, a label on the Timeline Labels page and a Trip on a tab of the Trip
Lines page, though a label like "Japan" usually was the trip. They're one now: every timeline label is a Trip with no
legs, and its file didn't change.

> **Frontend analogy:** a Trip is a lookup table from a date range to a name, like a `Map<[start, end], name>`, that
> the Timeline checks each day heading against while rendering. Its legs are like a layout route wrapping several
> pages: each day still renders its own line, and the Trip only adds what sits between them.

## The file

Each Trip is one file, `timeline/<id>.json`, and **Commit** combines them into `timeline/TIMELINE.json` the way it
combines the metadata groups into `METAINFO.json` (`be-pipeline/internal/github/trips.go`):

```json
{
  "id": "japan-2026-09-22",
  "name": "Japan",
  "start": "2026-09-22",
  "end": "2026-10-02",
  "legs": [
    {
      "mode": "flight",
      "from": {
        "day": "2026-09-22",
        "spot": { "latitude": 40.6413, "longitude": -73.7781, "label": "JFK" }
      },
      "to": { "day": "2026-10-01" }
    },
    { "mode": "ferry", "from": { "day": "2026-10-01" }, "to": { "day": "2026-10-02" } }
  ]
}
```

- **`start`** and **`end`** are the first and last days the Trip covers, both included, written `YYYY-MM-DD`. A
  photo's day is the day of its custom date, or else its EXIF date, as the Timeline groups it.
- **`legs`** are left out when there are none, as a timeline label was written.
- Trips can't overlap: saving one whose days another Trip already covers fails, so each day has at most one Trip. If a
  hand-edited file does overlap, the Timeline shows both names joined with " · ".
- The ID is the name and first day as an ID, made when the Trip is first saved and kept when it's renamed or its days
  change.

### Trips saved before the merge

Before the merge, a Trip was saved in the trip lines folder as `triplines/trip-<slug>.json`. Such a file is still
read, so its legs are still drawn, its days still go on its page and other Trips still can't take its days, and the
Trips page lists it with a note that the Timeline doesn't show it yet. **Save Trip** moves it: it saves
`timeline/<id>.json` and removes the old file, both as changes waiting for Commit.

## The page

The left side lists the Trips, newest first, each with its days, how many legs it has and how many saved photos were
taken on its days. The right side edits the chosen Trip, or a new one after **New Trip**: its name, first day and last
day (left empty, the last day is the first), then its **Legs between days**. The editor says how many photos fall in
the days typed, and says so before saving when another Trip already covers some of them. The chosen Trip is in the URL
as `?trip=<id>`; an old link to `/timeline-labels`, or to the Trip Lines page's Trips tab
(`/trip-lines?tab=trips&trip=<id>`), opens this page.

Each leg has a mode (**Ferry**, **Flight**, **Train**, **Bus** or **Car**), the day it **Leaves** and the day it
**Arrives**. Days can be skipped, such as a flight out on the first day and home on the last. A leg leaves from the
day's last photo with an exact spot and arrives at the day's first, or from or to **A spot with no photo**, such as an
airport or "Home", typed as a label and `latitude, longitude`. The row shows the photo it uses and how far the leg is
in a straight line.

**Save Trip** (`PUT /api/trips/<id>` → `PUT /trips/{id}`) and **Remove Trip** (`DELETE /api/trips/<id>` →
`DELETE /trips/{id}`) keep the file as a [change waiting for Commit](pending-changes.md), counted by the sync button as
a Trip. The page reads the Trips from the [combined data store](combined-data-store.md)'s `TIMELINE.json` with those
changes made over it, so a saved Trip shows at once. Photos in Flight lists the Trip files with the others.

## The legs on the map

Commit bakes each leg into `triplines/TRIPLINES.geo.json` as a line with its `trip`, the `day` it left and the day it
`arrive`d, counted as `tripLegs` (`trips_map.go`). A flight is drawn as a gentle arc bowed toward the nearer pole, the
way a great circle looks on a flat map, and crosses the date line rather than going around the world the other way. A
leg whose day has no photo with an exact spot, and no spot of its own, isn't drawn.

## Locally

`pnpm photos:local` also makes `TIMELINE.local.json`, which the portfolio uses in place of the committed file.
