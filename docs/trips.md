# Trips

A **Trip**, on the **Trips** tab of the [Trip Lines](trip-lines.md) page (`/trip-lines?tab=trips`), names runs of days, such as **Korea** for September 20 to 21, 2026
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

Trips and timeline labels used to be two things, a label on the Timeline Labels page and a Trip on the Trips tab, though a label like "Japan" usually was the trip. They're one now: every timeline label is a Trip with no
legs, and its file didn't change.

> **Frontend analogy:** a Trip is a lookup table from a date range to a name, like a `Map<[start, end], name>`, that
> the Timeline checks each day heading against while rendering. Its legs are like a layout route wrapping several
> pages: each day still renders its own line, and the Trip only adds what sits between them.

## Timeline labels within a Trip

A Trip can name parts of itself on the Timeline: a "Korea and Japan" Trip from September 12 to October 2 with the
label **Korea** on September 12 to 21 and **Japan** on September 22 to October 2. The Timeline shows the label of each
day in place of the Trip's name, and a day no label covers shows the Trip's name. The Trip stays one Trip everywhere
else: one Trip page for its days' stories, one set of legs, one Smart Album rule.

Under its name and days, a Trip's page lists its **Timeline labels**: each one's name, and a row of the Trip's own
days to pick its days from. A click picks the first day and a second click the last (the same day again for a
one-day label), and a shift-click picks every day from the last one clicked to it; days another label has are
struck out. **Add a timeline label** starts a new one the day after the
last label ends. Labels can't share a day, and must be within the Trip.

> **Frontend analogy:** like a date range picker whose calendar only shows the Trip's days.

## Combining Trips

**Combine Trips** on the Trips tab turns the cards into ones to pick. Pick two or more, check the combined Trip's name
(their names joined with "and", oldest first), and **Combine N Trips** saves one Trip in their place and opens its
page (`POST /api/trips/combine` → `POST /trips/combine`, `be-pipeline/internal/github/trips_combine.go`):

- Its days run from the earliest first day to the latest last day, and it has all their legs.
- Each Trip it combines becomes a timeline label on that Trip's days, or keeps its own labels when it has some, so the
  Timeline reads the same as before.
- It keeps the ID of the earliest Trip, so a Smart Album or link that used that one still works. Those that used the
  others need their Trip picked again.
- Its days' stories become one Trip page.

The new file and the removal of the others are one save, a [change waiting for Commit](pending-changes.md). Combining
fails when another Trip falls within the combined days (pick it too), or when the Trips' labels would share a day.

> **Frontend analogy:** combining is like merging several list items into one, with each old item kept as a
> sub-item, in one state update rather than a delete followed by an add, so nothing renders half done.

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
    {
      "mode": "ferry",
      "from": { "day": "2026-10-01", "photo": 307 },
      "to": { "day": "2026-10-02" }
    }
  ]
}
```

- **`start`** and **`end`** are the first and last days the Trip covers, both included, written `YYYY-MM-DD`. A
  photo's day is the day of its custom date, or else its EXIF date, as the Timeline groups it.
- **`labels`** are the [timeline labels within it](#timeline-labels-within-a-trip), each `{ "name", "start", "end" }`,
  left out when there are none.
- **`legs`** are left out when there are none, as a timeline label was written. Each end has its `day`, and either a
  `spot` with no photo or the ID of the day's `photo` it leaves from or arrives at; with neither, it's the day's last
  photo with an exact spot where it leaves and its first where it arrives. A `photo` that isn't from that day, or has
  no exact spot, falls back to the same. A train, bus or ferry leg can also have the `line` it rode and its track as `path`
  (`[longitude, latitude]` points, at most 20,000); see [Stations and routes](#stations-and-routes).
- Trips can't overlap: saving one whose days another Trip already covers fails, so each day has at most one Trip. If a
  hand-edited file does overlap, the Timeline shows both names joined with " · ".
- The ID is the name and first day as an ID, made when the Trip is first saved and kept when it's renamed or its days
  change.

### Trips saved before the merge

Before the merge, a Trip was saved in the trip lines folder as `triplines/trip-<slug>.json`. Such a file is still
read, so its legs are still drawn, its days still go on its page and other Trips still can't take its days, and the
Trips tab marks it **Save to show on the Timeline**, and its page says the same. **Save Trip** moves it: it saves
`timeline/<id>.json` and removes the old file, both as changes waiting for Commit.

## The tab and each Trip's page

The Trips tab lists every Trip as a card, newest first, with its days, how many saved photos were taken on them and
how many legs it has. Clicking one opens its own page, `/trip-lines/trips/<id>` (**New Trip** opens
`/trip-lines/trips/new`), with **All Trips** to go back. From the top:

- **The map** (`components/trips/trip-map.tsx`, `lib/trip-map.ts`): each day's line and photos, with the day's number
  (1 for the Trip's first day) at its first photo, and the legs between them, drawn with the portfolio map's own
  layers (`@portfolio/lib/trip-line-layers`): a ferry in teal dots, a flight in pink dashes. It fits the days' photos,
  so a long flight home runs off its edge rather than zooming out to the whole world, and it follows what's typed, so
  a leg shows as soon as it's added. A leg is a straight line here; Commit bakes a flight as an arc for the portfolio.
- **Name, first day and last day** (left empty, the last day is the first). It says how many photos fall in the days
  typed, and says so before saving when another Trip already covers some of them.
- **Days and legs** (`components/trips/day-legs.tsx`): every day of the Trip, first to last, each linking to its Route
  page when it has a route to mark. Under each day are the legs that **leave** it, edited in place, and **Add a leg
  from this day**; a day lists the legs that **arrive** on it too, such as "Arrives by Flight (leg 1, from Tue, Sep
  22, 2026)". A day can have any number of legs, and a leg can arrive the same day it left. The legs are kept in the order
  they happen, so their numbers follow the Trip: by the day each leaves, then the time of the photo it leaves from (a
  spot with no photo counts as the end of its day, as the day's last photo would), then when it arrives
  (`legsInOrder` in `lib/trip-legs.ts`). Opening a Trip puts its legs in that order, and changing a leg's day or photo
  moves it to its place.

Saving a new Trip moves to its page; removing one goes back to the tab. An old link to `/timeline-labels` or `/trips`
opens the Trips tab, and one to a Trip on the tab (`/trip-lines?tab=trips&trip=<id>`) opens that Trip's page.

Each leg has a mode (**Ferry**, **Flight**, **Train**, **Bus** or **Car**), the day it **Leaves** and the day it
**Arrives**, and where on each day: **The day's last photo** where it leaves or **first photo** where it arrives (the
photos with an exact spot), **one of the day's photos** picked by its time and title, such as one taken at the
airport, or **A station or spot with no photo**, such as "Home", typed as a label and `latitude, longitude`. Picking a
photo is what lets one day have several legs from different places. The row shows the photo it uses and how far the
leg is in a straight line.

### Stations and routes

A **Train**, **Bus** or **Ferry** leg can leave from and arrive at a station. With **A station or spot with no photo**
picked, **Find a station** looks up the stations (or stops, or ferry terminals) whose name in any language has the
words typed, within 30 km of that end's day (its spot once it has one, or else its photo), nearest first, each with its
English name beside it, such as "博多 (Hakata)". Picking one fills in the label and position
(`GET /api/transit/stations?mode=train&q=Hakata&near=<lng,lat>`, `be-pipeline/internal/transit/stations.go`, through
the same Overpass servers, throttle and day-long cache as [Lines ridden](trip-lines.md#lines-ridden)).

Once both ends have a spot, **Look up route** finds the lines of the leg's kind that pass within 500 m of both ends
(the same look-up as a day's hops, so it works best with each end at its station), and picking one fetches its track
between them. The leg is then saved with the `line` (its ID, name, number and color) and its `path`, drawn along the
track in the line's color on the Trip's map and the portfolio's, instead of a straight line. **Clear** takes it off.
Moving either end drops the track picked for the old spots (renaming one keeps it), and a flight or drive keeps no
line.

> **Frontend analogy:** the station search is an autocomplete endpoint scoped to a map viewport, like a places search
> with a `near` bias, and the route is the same "find the paths in the sprite sheet" look-up as a day's hops, clipped
> between the two stations.

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
