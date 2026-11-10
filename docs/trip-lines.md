# Trip Lines

`/trip-lines`, under **Configuration** in the sidebar, marks the route of a day: a solid line walking from photo to
photo in the order they were taken, and a dashed hop by train, subway, bus or car between two of them. Commit bakes
every day's line, with its photos' spots filled in, into one file the portfolio's map can draw as it is.

> **Frontend analogy:** the day files are the source, like `.tsx`, and `TRIPLINES.geo.json` is the build output, like
> the bundle. Commit is the build step, so the browser never works routes out; it only loads the result.

## The file

Each day with a line is one file, `triplines/<YYYY-MM-DD>.json`, and **Commit** combines them into
`triplines/TRIPLINES.json` the way it combines the [Trips](trips.md) into `TIMELINE.json`:

```json
{
  "id": "2026-10-01",
  "day": "2026-10-01",
  "auto": false,
  "segments": [
    {
      "mode": "walk",
      "start": { "latitude": 34.6655, "longitude": 135.5006, "label": "Hotel" },
      "photos": [302, 303, 304]
    },
    { "mode": "subway", "photos": [304, 305] },
    { "mode": "walk", "photos": [305, 306, 307] }
  ]
}
```

- **`name`** on a segment names the group of photos it's in, such as "Nara Park": each [group](#groups) is a line of
  its own. A walk or hop from one group to the next has none.
- **`visits`** are the [trip stops](#trip-stops) along the day's route, such as restaurants.
- **`fences`** are the [areas](#areas) photos without an exact spot were taken in, such as a park.
- **`segments`** are the stretches of the day, in the order they happened. Each one's line runs from `start` (when
  set), through its `photos` (photo IDs) in order, to `end` (when set). `from` and `to`, when set, are drawn instead of
  the first and last photo: the exit and entrance of an [area wandered](#areas-wandered).
- **`order`** is the day's photo IDs in the order they were [moved into by hand](#groups), such as when a camera's
  clock was off; left out while they're in the order taken.
- **`mode`** is `walk`, `train`, `subway`, `bus`, `car` (taxis too), `transit` (a hop whose kind isn't known, as the
  automatic line marks one) or `wander` (an [area wandered](#areas-wandered) with no set route, drawn with no line). A walk is drawn through every photo; the others are a straight dashed line from the first
  point to the last, since the real track isn't known.
- One photo can end a segment and start the next (304 and 305 above), so the line doesn't break at a station.
- **`start`** and **`end`** are spots with no photo, such as the hotel, with an optional `label`.
- **`via`** lists spots with no photo the line bends through, each with the photo it comes `after` (none for right
  after `start`), and `visit` when it stands for a [trip stop](#trip-stops) on the route. See [Shaping the line](#shaping-the-line-and-snapping-it-to-streets).
- **`path`** is a walk, bus or car segment's line along the streets, as `[longitude, latitude]` pairs, from **Snap to
  streets**, or a hop's track along its `line`. A train, subway or transit hop keeps one only with a line.
- **`line`** is the bus, subway or train line a hop rode, picked under [Lines ridden](#lines-ridden):
  `{ "id": 1234, "name": "Midosuji Line", "ref": "M", "colour": "#e5171f" }`, where `id` is the OpenStreetMap route
  relation. Only train, subway, bus and transit hops keep one.
- **`board`** and **`alight`** are the station or stop a hop with a `line` got on and off at, with its name as the
  `label`, when that isn't at the photo: say the subway was left and then a 10-minute walk led to the next photo.
- **`boardWalk`** and **`alightWalk`** shape the walk from the hop's first photo to `board`, and from `alight` to its
  last photo: `{ "via": [{ "latitude": …, "longitude": … }], "path": [[lng, lat], …] }`, both optional. Without them
  (or with a `path` that no longer fits) the walk is straight through its via spots.
- **`auto: true`** turns on the [automatic line](#the-automatic-line); its segments are filled in by the backend.

A photo in a line must be from that day (its [custom date](data-model.md#date-taken), or else its EXIF date) and have
an exact spot: its custom GPS position, its EXIF one, or a [place](places-and-localizations.md) marked as an **Exact
location**. Saving (`PUT /api/triplines/<day>` → `PUT /triplines/{day}`) fails otherwise, and so does a segment with
fewer than two points. Saving and **Remove route** (`DELETE /api/triplines/<day>` → `DELETE /triplines/{day}`) keep the
file as a [change waiting for Commit](pending-changes.md), counted by the sync button as a trip line.

## The baked map: `TRIPLINES.geo.json`

Every Commit also writes `triplines/TRIPLINES.geo.json`, a GeoJSON `FeatureCollection` with one `LineString` per
segment, coordinates filled in from the photos:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [135.5006, 34.6655],
      [135.5012, 34.6663]
    ]
  },
  "properties": {
    "day": "2026-10-01",
    "mode": "walk",
    "auto": false,
    "photos": [302],
    "km": 0.1,
    "start": "Hotel"
  }
}
```

A hop with a `board` or `alight` station also gets a walk feature from its first photo to where it got on, and from
where it got off to its last photo, along its `boardWalk` or `alightWalk` when it has one.

Each feature also has its segment's `name`, so the portfolio can show one group's line at a time.

Each feature also has `line`, `ref` and `colour` when its hop rode a picked line, so the portfolio can draw it in the
line's color and name it.

A segment with a `path` is drawn along it, as long as the path still starts and ends within 300 m of the segment's first
and last points; otherwise (say a photo's GPS position was fixed since) it falls back to straight lines through its
points until it's snapped again.

It's rebuilt from the day files and the photo files at each Commit, so fixing a photo's GPS position or date fixes its
line on the next one. Only photos on the portfolio are drawn (not drafts or [unselected
photos](compare-groups.md#unselected-photos)); a segment left with fewer than two points is skipped. Commit's counts say
how many lines it has (`tripLineSegments`).

## The automatic line

The automatic line is one walk through the day's photos in the order they were taken, broken where two photos are
more than 2 hours apart, with a `car` drive across a big jump (two photos more than 15 km apart and taken within
6 hours of each other) and a `transit` hop where moving between two (more than 300 m apart) was faster than 6 km/h
(`autoSegments` in `be-pipeline/internal/github/triplines_auto.go`). `GET /api/triplines/<day>/auto` answers it for the
day as the next Commit would draw it.

A file with `"auto": true` keeps it on: it's worked out again at every Commit, so a photo added to that day later joins
the line. Its `segments` hold the line as it was last worked out: when it's turned on, and again at each Commit when
the photos draw it differently (`refreshAutoLines`), so the file and `TRIPLINES.json` show it as drawn.

The automatic line passes through the day's [trip stops](#trip-stops) put on the route the way a line drawn by hand
does: a stop after a photo the line walks on from becomes a via spot with `visit` on that walk (`withStopVias` in
`triplines_auto_stops.go`, and the same in the editor's `lib/trip-stops-kept.ts`). A stop after a walk's last photo,
or on a hop or drive, stays a pin.

> **Frontend analogy:** the segments are a cached copy of a derived value, like persisting a `useMemo` result next to
> its inputs and refreshing it whenever they change.

## The page

`/trip-lines` lists the days with two or more photos at two or more different exact spots, newest first, as cards. Each
card has how many photos and spots the day has, whether its line is **Marked**, **Out of date**, **Automatic**,
**Planned** or **None** (with a filter by each), and a small drawing of the line from its file, by hand or automatic: the line in
the map's colors and the photos as dots, drawn as SVG with no basemap so a long list stays quick. An automatic line
saved before its segments were kept shows a note until it's saved again or the next Commit fills them in. **Out of date** (in red) is a line marked by hand
that doesn't go through every photo of the day with an exact spot, such as photos added since, or goes through photos
no longer on that day; the Dashboard's **Needs attention** lists them as urgent and links to this list filtered to
them. A new photo opens with a break on both sides, ready to join the line.

A card opens the day's own pages, each a tab with its own link:

| Page        | Path                      | What it has                                                                                             |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Photo order | `/trip-lines/<day>/order` | The photo strip on its own, its groups stacked top to bottom with what happened between them in between |
| Route       | `/trip-lines/<day>/route` | The strip with the map and its tools, as below                                                          |
| Trip Stops  | `/trip-lines/<day>/stops` | The strip, the map, and the [trip stops](#trip-stops) list                                              |
| Story       | `/trip-lines/<day>/story` | The [Trip page story](#trip-page-story)                                                                 |

`/trip-lines/<day>` opens Photo order. The pages share one editor that stays mounted while hidden, so a change made on
Photo order shows on Route before it's saved, and **Save route** on either saves both. **Every day** goes back to the
list.

> **Frontend analogy:** the editor's state lives above the tabs, like lifting `useState` into a layout so switching
> nested routes doesn't reset a form.

The pages keep what's chosen in their URL, so a link or a reload opens them the same way (`lib/trip-lines-search.ts`,
read by each route's `validateSearch`):

| Param   | Where    | What it opens                                                           | Unless set |
| ------- | -------- | ----------------------------------------------------------------------- | ---------- |
| `tab`   | The list | `trips` for the Trips tab                                               | Days       |
| `show`  | The list | The day list's filter: `marked`, `out-of-date`, `automatic`, `none`     | All        |
| `trip`  | The list | A Trip on the Trips tab, from an older link: opens [its page](trips.md) | None       |
| `group` | A day    | The group shown alone on the map (the eye), by its name                 | None       |

For example, `/trip-lines?show=out-of-date` or `/trip-lines/2026-09-29/route?group=Engyoji%20Temple`. Clicks replace
the history entry rather than adding one, so Back leaves the page. A new Trip isn't in the URL until it's saved. A link
from before days had pages, `/trip-lines?day=2026-09-29&group=…`, opens that day's Route page.

> **Frontend analogy:** this is TanStack Router's search params used as the page's state store instead of `useState`,
> like keeping a table's sort and filter in the query string.

The Route page edits the day: its photos in the order they were taken, with what happened between each two, and
a map of the line drawn through them (photos as numbered dots; walks solid, hops dashed). Pointing at a photo
highlights its dot.

- A day with no line offers **Preview automatic line**, drawn fainter and not saved, and **Mark by hand**, which starts
  from one walk through every photo. From the preview, **Turn on automatic line** saves `{ "auto": true }`, and **Edit as
  my own** copies it into the photo strip to change by hand.
- By hand, each gap between two photos is a menu: **Keep walking**, **Break** (the line stops, and starts again at the
  next photo), or a hop. An arrow marks each photo a line starts at and a flag each one it ends at (not a pin, since every photo in the strip has an exact spot; ones without go in [areas](#areas) instead). **Starts from** and
  **Ends at** set a spot with no photo by clicking the map, with a label such as "Hotel". **Save route** saves it.
- An automatic day shows the line as the next Commit would draw it, with **Update automatic line**, **Edit as my own**
  and **Turn off automatic line**. Putting trip stops on the route, moving them or taking them off (in the strip or on
  Trip Stops) keeps the line automatic, with a note that they aren't saved yet; any other change, such as a gap or the
  photo order, starts a line by hand. **Update automatic line** saves the line again as the day's photos and stops
  draw it now, so photos added since show without waiting for Commit.
- Changing what kind of line a day has never loses its trip stops or areas. **Turn on automatic line**, **Edit as my
  own** and **Turn off automatic line** carry them over, and removing the route of a day with stops keeps them as a line
  with no segments, marked `"planned": true` like a [planned day](#planned-days), which opens with no line drawn and its
  stops still on the map. A day with no stops or areas is removed outright.

### Planned days

**Plan a day**, above the cards, picks a date before its photos are taken and opens its Trip Stops page, to add the
[trip stops](#trip-stops) ahead, such as the restaurants booked for a day in Kyoto. Any day can be opened that way: a
day without two or more photos at two or more exact spots says it's a planned day. Its map starts on the whole world
until the first stop is added (by coordinate, or on the map), and saved places near its stops can be added from then
on. Saving keeps it as a line with no segments, marked `"planned": true`, listed as **Planned** with how many stops it
has. Once its photos are added, the day opens as walking through them with the stops kept (not put on the route yet),
the way a line marked by hand starts; saving it then drops `planned`. A planned line is never **Out of date**.

> **Frontend analogy:** a planned day is like a draft route created before its data loads: the page renders from the
> saved stops alone, and the photos hydrate it once they exist, rather than the page waiting for them.

## Trip Stops

Trip stops were called places visited; they're named apart from the [saved places](places-and-localizations.md) on
the Places page, which a stop can be added from. An old `/trip-lines/<day>/places` link opens Trip Stops. In the files
they're still `visits`.

The day's **Trip Stops** page lists the stops along the day's route, with or without a photo: a restaurant,
café, bar, shop, museum, sight, station or other. It's only for adding them: **Add a stop on the map** drops one where the map
is clicked; **Add a saved place nearby** adds one of the [saved places](places-and-localizations.md) within about 10 km
of the day's photos, named after it; and **Add at this coordinate** adds one at a latitude and longitude typed or
pasted in, such as `34.6672, 135.5013` from Google Maps (degrees and minutes work too); and **Add a station** finds a
train, subway, bus or ferry station by name within 30 km of the day's first photo (the [station search](trips.md) a
Trip's legs use) and adds it as a **Station** stop, such as one changed trains at. Each row says where the stop
is on the route, which Photo order and Route set. Each has a kind, a name (needed to save), a note, and a link to it on Google Maps, Naver
Map or any other map, which opens from the row. The map shows each as a round pin with its kind's icon.

### Casual photos

A stop can have **casual photos**: snapshots taken there, such as the food at a restaurant, that show only with the
stop on the day's [Trip page](trip-pages.md#trip-stops), never in the Gallery, the portfolio's Grid or Map, or on a
trip line. **Add casual photos** under a stop opens a grid of every photo taken that day (on the portfolio, drafts,
Undecided ones and casual photos of other stops; `components/trip-lines/casual-photos.tsx`), and picking one adds it.
Its thumbnail's cross takes it off again. The stop keeps their IDs in `photos` (at most 50, each once), and each
photo's file gets `"casual": true` as a local edit waiting for Commit (see [Drafts](drafts.md)); taking a photo off, or
removing the stop, clears the mark. **Save line** so the stop keeps its photos.

A casual photo is left off the day's photo strip and line, out of `ALLPHOTOS.json`, and out of the Dashboard's
**Drafts** card and **Needs attention** counts, since it needs no title, tags, album or GPS of its own.

> **Frontend analogy:** `casual` is like a `hidden` flag on a CMS entry: the record still exists and the editor can
> see it, but the public list query filters it out, and only the one page that asks for it by ID shows it.

They're saved with the line as `visits`:

```json
{
  "name": "Ichiran Dotonbori",
  "kind": "restaurant",
  "latitude": 34.6688,
  "longitude": 135.5026,
  "note": "Ramen before the river walk",
  "link": "https://maps.app.goo.gl/…",
  "place": "ichiran-dotonbori",
  "after": 305,
  "photos": [311, 312]
}
```

The photo strip on **Photo order** and **Route** puts these places on the route: the pin with a plus under each gap,
shown on hover, lists the day's places not on the route yet, and picking one puts it between those two photos (with a
link to the Trip Stops page to add more). `after` is the photo it comes after. The line then goes from that photo through the place to the next one: the
segment lists it as a via spot with `"visit": 0` (its index in `visits`), after the via spots of its own, so **Snap
to streets** routes through it and the map draws it on the line. The photo strip shows the place's icon between those
two photos, its name shown on hover, with the way between the two photos shown on both sides of it. Pointing at that icon shows arrows that move the place one photo earlier or later on the
route, and a cross that takes it off the route again. Moving one earlier from after the
first photo puts it before the first photo, as `"first": true` with no `after`, such as lunch before the first photo
was taken: the line goes from the start spot through it to the first photo (as a via spot after the start spot), or,
with no start spot, starts at it. The way from there to the first photo shows before photo 1 in the strip and can be
changed like any gap, such as a bus from lunch: the line is then a hop from the start to the first photo before the
walk, saved as the first segment with that mode, a `start` and only the first photo. Moving one later from the last gap,
or picking it from the pin with a plus after the last photo (shown on hover), puts it after the last photo, such as
dinner after the last photo was taken: the line ends there. With an end spot, the line goes from the last photo
through it to the end spot (as a via spot after the last photo); with none, the last segment's `end` is the place,
named after it, and when the day ends with more than one such place, the line goes through the others to the last one
added. The strip shows the walk and the place's icon after the last photo, and loading the line again
keeps that `end` as the place rather than an end spot of its own. A place not on the route is a pin only, and a place
put after a break in the middle of the day has no line to sit on, so it stays a pin too. The editor works the via spot out from `after` each
time, so moving or removing the place keeps the line in step; the backend checks that `after` is one of the day's
photos with an exact spot (not necessarily on a drawn segment, so a stop can follow a photo on an automatic line or at
a break) and that every `visit` names a place the day has.

> **Frontend analogy:** the via spot is derived state, like a `useMemo` over `visits`: `visits` is the source of
> truth, and the saved via spot is only written out so the portfolio and the router don't need to know about places.

`place` is the saved place's ID when one was picked. The link has to be an `http` or `https` web address. Commit bakes
each into `TRIPLINES.geo.json` as a GeoJSON `Point` with `"feature": "visit"`, the day, and the name, kind, note and
link, next to the lines, and counts them (`tripLineVisits`). The Timeline's route sketches draw them; the portfolio's
Map doesn't.

## Areas

A line only goes through photos with an exact spot: their own GPS position, or a place marked as an exact location.
A photo that only has a neighbourhood or a park as its place has no point to draw, so **Areas** (under **Places
visited**, on a day that has such photos) puts it in the area it was taken in, and the map shades that area with a
dashed edge.

Type a name, or a Wikidata ID such as `Q1490`, and press **Find an area**. The box starts with the place or city of the
first photo not in an area yet. Picking a result adds the area holding every photo not in one yet. Click a photo under
an area to put it in or take it out; a photo is in one area at most. Rename or remove an area from its row.

The backend asks OpenStreetMap's [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) for places with
an outline (`polygon_geojson`), simplified to about 50 m (`polygon_threshold`) and kept to 5,000 points. A Wikidata ID
is looked up through the item's [OpenStreetMap relation ID (P402)](https://www.wikidata.org/wiki/Property:P402); an item
without one can't be used, so search by name instead. Requests go at most once a second and name the pipeline in
their `User-Agent`, as the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks.
`NOMINATIM_URL` and `WIKIDATA_URL` point it at other servers.

A search asks only when **Find an area** is pressed, never while typing. A name is one Nominatim request and a Wikidata
ID is two (Wikidata, then Nominatim). The page keeps each answer until it's reloaded, and the backend keeps it for a
day (up to 100 searches, `internal/memo`), so asking the same thing again sends nothing. Neither server needs a key or
charges for requests; the only limit is the one a second. Under the box, **OpenStreetMap names** and **Wikidata IDs**
open the same text on [Nominatim's search page](https://nominatim.openstreetmap.org/ui/search.html) and Wikidata's
search in a new tab, so the exact name or ID can be found there before searching here.

The outlines are OpenStreetMap data under the
[ODbL](https://www.openstreetmap.org/copyright), like the lines ridden.

They're saved with the line as `fences`:

```json
{
  "name": "Upper East Side",
  "photos": [24, 28, 31],
  "osm": "R…",
  "shape": [
    [
      [
        [-73.9727, 40.7644],
        [-73.959, 40.7584],
        [-73.942, 40.782],
        [-73.9727, 40.7644]
      ]
    ]
  ]
}
```

`shape` is a GeoJSON `MultiPolygon`'s coordinates: polygons, each an outer ring then any holes, each ring closed. The
backend checks that each photo was taken that day and each ring is closed and on the globe. Commit bakes each into
`TRIPLINES.geo.json` as a `MultiPolygon` with `"feature": "fence"`, the day, the name and the photos, and counts them
(`tripLineFences`).

> **Frontend analogy:** Nominatim is a search API like an autocomplete endpoint, but its answers carry the shape
> too, the way an image search returns the picture and not only its name. The backend is the one calling it, so the
> once-a-second limit holds however many tabs are open.

## Trips

A day's line can't cross midnight, so the ferries and flights between days are the legs of a [Trip](trips.md), on the
Trips tab. Commit bakes them into `TRIPLINES.geo.json` with the days' lines.

## Groups

A day often holds several outings, such as three parks. The photo strip splits the day into groups, each its own line
with a name:

- Every day shows its groups from the start, whatever its line: a day with no line or an automatic one is grouped by
  their [place](places-and-localizations.md) over the line it shows. A group starts wherever the first place of a
  photo changes, named after it, and a photo with no place stays in the group before it. Changing anything in the
  strip (a gap, a name, a split) starts a hand-drawn line from what was shown, as **Mark by hand** or **Edit as my
  own** would; nothing is saved until **Save route**.
- Clicking a photo opens it on the Photo page in a new tab (`/exif?photo=<id>`, which finds the photo's file in the
  pull request or else on the base branch), to change its Place or anything else. Reload the Trip Lines page after
  saving it there to see the groups follow the new Place.
- Each group's header has its name, how many photos it has, a button that collapses it to the header, and an eye that
  shows that group alone on the map, the others faded.
- The shapes button on a group's header edits the area of the group's place (the place of its first photo), the same
  area as the place's own page: find one by name or Wikidata ID, or remove it. It's light blue when the place has one,
  and the day's map shades the areas of every place on the day. A place with no area but with a GPS position gets a
  dashed circle 80 m around its position instead (`circleShape` in `portfolio/src/lib/place-circle.ts`), so it reads
  as the place's surroundings rather than one more pin. For a single building, finding it by name gives its
  footprint as the area when OpenStreetMap maps its outline.
- Each photo shows its number on the map before the time it was taken, such as **3 · 14:59**.
- Pointing at a photo shows arrows that move it one place earlier or later in the day, for a camera whose clock was
  off. The new order is saved with the line as `order`, and the map's numbers and line follow it. A photo added to the
  day since goes after the photo taken just before it.
- Pointing at the menu between two photos shows the scissors under it: **Cut to a new place here** starts a new group
  at the photo after it. The join button between two groups merges them. The menu between two groups picks what
  happened between them, like any gap.
- The shuffle button on a group's header marks it as an [area wandered](#areas-wandered).

Saving writes each group's name on its segments, and a walk crossing from one group into the next is split there, so
the stretch between the two groups is its own unnamed segment. Opening a saved line rebuilds the groups from those
names. A line saved with no names is grouped by place again, and a group left unnamed isn't kept.

> **Frontend analogy:** groups are like `<details>` sections over one list: they change how the list is shown and
> labeled, but the photos and gaps underneath stay one array.

### Areas wandered

For a hike or an afternoon wandering a park with no set route, the shuffle button on a group's header makes every gap
inside it **Wandered the area** (`wander`), and pressing it again walks through the photos again. No line is drawn
through a wandered group's photos; the map shades the place's area, or circles it, instead. Under the map, **Areas
wandered** lists them, each with **Entrance on the map** and **Exit on the map**: click the spot where the day entered
and left the area, such as a park's gates. They're kept for that day only. The line from the photo before then runs
to the entrance, and the line to the next photo from the exit, instead of to and from the photos inside
(`lib/trip-wander.ts`, `components/trip-lines/area-ends.tsx`).

They're saved on the segments around the area: `to` on the one coming in (by the area's first photo) and `from` on
the one going out (by its last). Commit bakes those segments through them (`areaEnd` in `triplines_route.go`), snapping
to streets follows them too, and a `wander` segment bakes no line at all.

> **Frontend analogy:** like `position: absolute` children inside a box: the photos still belong to the group, but
> the line only connects the box's doors.

## Shaping the line and snapping it to streets

A line drawn by hand is straight from point to point. To make it follow the streets:

1. **Add via points**, then click the map where the line should bend. Each click puts a via point in the stretch of the
   line nearest it. A hop with a line picked follows the line's track, so a via point never goes on the ride itself, but
   it can go on the walk from the photo to the station it got on at, or from the stop it got off at to the next photo.
   Drag a via point to move it, or click it to remove it. **Done adding via points** stops adding. The map numbers via
   points v1, v2, … in the order the route goes through them, and the list under the tools says where each is ("After
   photo 2", "Walk from Broderick St & Francisco St to photo 3"). Its arrows move one a place earlier or later: past
   the next via point, or past the photo or station at the end of its stretch into the next one, so a lone via point
   after photo 3 moves up onto the walk from the bus stop to photo 3. Its × removes it. The photo strip on **Route** shows the
   same numbered squares between the two photos each via point is between, before that stretch's trip stops; pointing
   at one says where it is.
2. Once the straight line looks right, **Snap to streets** asks the [OpenStreetMap routing
   servers](https://routing.openstreetmap.de/about.html) (FOSSGIS's OSRM) for the way along the streets through every
   walk, bus or car segment's points and via points, walking on foot and buses and cars by road, and for every walk to
   or from a station. Train and subway hops without a line stay dashed straight lines.
3. **Save route** saves the paths with the line. Snapping alone saves nothing.

`POST /api/triplines/<day>/route` → `POST /triplines/{day}/route` takes the line, checks it as saving would, and answers
`{ "line": …, "unrouted": n }`: the line with a `path` on each street segment that didn't have one, and how many got
no route (they stay straight). A segment keeps its path while it's unchanged; changing its photos, mode, ends or via
points drops it, and the page says how many stretches are straight again.

The routing servers ask for no more than one request a second, so `be-pipeline/internal/routing` waits between
requests, across every segment and every click, however fast they come. The button is off while a snap is running.
`ROUTING_URL` points the backend at another OSRM server with the same `routed-foot` and `routed-car` profiles, such as
one run locally.

> **Frontend analogy:** via points are like the control points of an SVG path you drag around in a design tool, and
> Snap to streets is a debounced `fetch` that swaps the rough path for a precise one. The backend's one-a-second wait is
> a throttle on that fetch, shared by every caller.

## Lines ridden

Under the map, **Lines ridden** lists each train, subway, bus or transit hop of a line drawn by hand. A hop with no line
yet looks up its lines at once: the ones of its kind that pass within 500 m of both of its photos. A transit hop of
unknown kind first asks **Look for a** **Train**, **Subway**, **Bus** or **Ferry** line, and looks nothing up until one
is picked, since looking for every kind at once is slow on OpenStreetMap's servers (the backend turns down
`mode=transit` with a 400). Picking another kind looks again; the hop stays a transit hop. Each is a [route relation](https://wiki.openstreetmap.org/wiki/Relation:route),
usually one direction of one line, listed with its number, color and ends. When everything found is one line (say,
its two directions), it's picked by itself; otherwise pick one. When the lines found are of more than one kind, **Bus**, **Subway** and **Train** (and **Other**, such as a ferry) show only that kind. Subway covers light
rail, monorails and trams. **Change line** looks again.

While it looks, the hop says it's asking OpenStreetMap, since a busy public server can take up to a minute (see
below). When nothing is found, often because a photo was a walk from the line (say the beach, 15 minutes from the end
of the line), **Got on near** and **Got off near** each find a station by name near that photo, the same search as a
[Trip's legs](trips.md#stations-and-routes). Picking one looks again with the station standing in for the photo, and the line then gets on
or off at the stop nearest it, so the walk from the photo to the station is drawn and baked as below. **The photo**
goes back to looking near the photo. The stations picked here only steer the look-up; what's saved is the line's own
**Got on at** and **Got off at**.

Picking a line gets its stations or stops and sets **Got on at** and **Got off at** to the ones nearest each photo.
Either can be changed to another station, such as one a walk away from the next photo, or to **At the photo**. The
hop is drawn along the line's track between them, solid in the line's color, with a walk from the first photo to where
it got on and from where it got off to the next photo. **Clear** goes back to the straight dashed hop, and **Save
route** keeps the line, the stations and the track.

### Looking lines up on Transitland

The menu beside **Find lines** (and beside a Trip leg's **Look up route**) picks where lines are looked up, and the
choice is kept in the browser for every look-up:

- **OpenStreetMap** (the default): the Overpass servers, as below. Its lines are each direction of a route, mapped
  by volunteers, and the public servers are often busy.
- **Transitland** ([transit.land](https://www.transit.land)): the timetables transit agencies publish as GTFS, with
  each route's shape and stops. A route is listed when it has a stop within 500 m of both ends
  (`GET /routes?lat=…&lon=…&radius=500&route_types=…`, once per end, each route once when Transitland lists two copies of a feed), its track is cut from its shape the same way as
  an OpenStreetMap line's, and its stops are put in order along its shape. It covers railways well (in Japan too),
  ferries less so. It needs a free API key as `TRANSITLAND_API_KEY` in the repo's `.env` (see `.env.example`), sent
  as the `apikey` header; without one the look-up says so. Answers are kept for a day, and the backend logs each
  request (`be-pipeline/internal/transit/transitland.go`; `TRANSITLAND_URL` replaces the server).

A line picked from Transitland is saved with `"source": "transitland"`, so its stops and track are fetched from there
again; one from OpenStreetMap has no `source`. The `?source=transitland` query below asks Transitland.

> **Frontend analogy:** it's the same component with two data providers behind it, like a `fetcher` prop that
> switches between two REST APIs returning the same shape.

- `GET /api/transit/lines?mode=subway&from=<lng,lat>&to=<lng,lat>` answers the lines found. `mode` is `train`,
  `subway`, `bus` or `ferry`.
- `GET /api/transit/lines/<id>/stops` answers the line's stations or stops in order, each with its `name`,
  `latitude` and `longitude` (its `stop` members, or else its platforms).
- `GET /api/transit/lines/<id>/track?from=…&to=…` answers `{ "path": [...] }`. It's the shortest way along the line's
  mapped ways between the points on it nearest each photo, so it works whichever way the ways were drawn. It fails
  with 422 when the line's track doesn't join the two spots.

Both ask the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) at `overpass-api.de`, which asks for
light use, so `be-pipeline/internal/transit` spaces its requests a second apart, through the same throttle as the
routing servers. The public servers are often busy and answer 429, 502 or 504, so when one does, the backend waits a
moment and tries the next of the
[public mirrors](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)
(`overpass.private.coffee`, then `maps.mail.ru`), going round them twice. Each try gets 40s, and the query asks the
server to stop after 20s (`[timeout:20]`; a lower value is also
[less likely to be turned away](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#timeout:) when the
server is loaded). The extra time is for a busy server's wait before it starts: even a query for the few ferry
terminals around Shimonoseki took overpass-api.de 22s. The whole look-up gets 100s (the BFF waits 105s), enough for
a full try on two servers. A query a server turns down as wrong (400) isn't tried again. When none answer, or the 100s
run out while one is still thinking, the page says the
servers are busy, which server answered last and how (such as "took too long to answer"), and to try again in a minute
(503).

The lines query is kept light: near the first photo it looks only at the ways the hop's lines run on (`railway` for a
train or subway, `highway` for a bus, `route=ferry` for a ferry), not the buildings and footpaths around a
station, and near the second photo it looks only at those lines' own ways
([`way(r.a)(around:…)`](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL))
instead of every way there.

> **Frontend analogy:** the old query was like `document.querySelectorAll("*")` around both photos and then filtering
> in JavaScript; the new one is `querySelectorAll(".rail")` around the first photo and then, for the second, only
> checking the children of the lines already found. Answers are kept in memory for a day, up to 200 of them, so looking up the same hop again, even after reloading
> the page, doesn't ask a server; restarting the backend clears them. `OVERPASS_URL`, a comma-separated list, replaces
> the servers asked.

> **Frontend analogy:** it's a `fetch` wrapper with retry, like TanStack Query's `retry` and `retryDelay`, that also
> switches to a backup CDN when the first one fails, plus a `staleTime` of a day kept on the backend.

> **Frontend analogy:** a route relation is like a named SVG `<path>` in a sprite sheet, such as `#midosuji-line`.
> Find lines searches the sheet for paths that pass near both photos, and picking one clips that path between them.

A hop's line is kept with the mode it was picked for. Changing the hop to another kind of travel leaves the line out,
and changing it back before saving brings it back. The walks to and from the stations are straight lines; Snap to streets
doesn't route them.

The page reads the day files from the [combined data store](combined-data-store.md)'s `TRIPLINES.json` with the
changes since made over it, so a saved line shows at once. It (and each Trip's page) waits until the changes waiting
for Commit that the backend kept from before a reload are made over the lists too (`hooks/use-session-data.ts`), so the
editors start from where the session left off rather than from the committed files, and don't miss changes that arrive
a moment after the lists.

The portfolio doesn't draw the lines yet; that's the next step.

## Trip page story

The day's **Story** page, **Trip page story**, writes the words around the day's photos for the portfolio's Trip
page: a caption on each photo, a paragraph between photos, and which photos share a row. See
[Trip Pages](trip-pages.md).
