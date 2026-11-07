# Portfolio Map

`/map` on the portfolio places every photo with a GPS position. It opens fitted to all of them, no closer than street
level, or on the whole world when there are none.

Each photo is a marker with its Square Thumbnail (or its Small version, cropped square), which opens the photo
viewer. Photos too close together to tell apart (within 40 pixels by default, a little under a marker's width; see **display options** below) are one round marker with how many there are, over three of their photos, the latest added by default,
fading in turn under a dark overlay. Clicking it zooms the map in to fit its photos, which splits it apart, like
a cluster pin on the Color page's wheel. A group that zooming in can't split (photos at one spot, or the map already as
close as it goes) opens a grid of their thumbnails instead: in a popup above it, or on phones in a sheet along the
bottom of the map, so it's never cut off at the top of the screen or hidden under the floating header
(`components/map-cluster.tsx`). Holding ⌘ (or Ctrl on Windows and Linux) while clicking any group opens that grid
straight away instead of zooming in. Photos without resized versions are a small dot that opens their details instead.

A photo's [custom GPS position](places-and-localizations.md#custom-gps-position), written on the Photo page, wins over
its EXIF one. A photo with neither goes at one of its places' position (see
[Places](places-and-localizations.md#gps-position)). That spot is only near where it was taken, so its marker's white
border is softer, and so is a group's when every photo in it is placed that way. A place marked as an **Exact
location** on the Places page keeps the solid border for its photos. Like every view, the map leaves out a photo with no date, EXIF or [custom](data-model.md#date-taken), even when it has a position.

From city zoom (12) in, small groups split into photos of their own, so a sparse area shows each photo rather than a
count: up to 3 photos at zoom 12, growing to 12 by zoom 16 (`fanLimit` in `lib/map-fan.ts`). Bigger groups stay one
marker until closer.

At every zoom, each marker, a photo's or a group's, sits on its own spot when there's room. When it would cover too much
of another, it's moved a little to a random spot nearby that's clear (`fanOffsets`, used by `markersInView` in
`lib/map-markers.ts`). Groups are placed first, biggest first, then photos, oldest first, so those stay nearest their
spots. How much one may cover another depends on the zoom (`fanSpacing`): from city zoom (12) in, none overlap; zoomed
out to 8 or further, markers may overlap, but none is more than half covered by another; in between, the allowed
overlap shrinks. The randomness is seeded by each photo's ID or group's, so a marker lands in the same place every time.
A pin under the pointer, or focused, comes to the front, so a partly covered one can be seen whole.

Where the map is looking is kept in the URL as its center and zoom (`?lat=37.57&lng=126.98&zoom=12.5`), half a second
after it stops moving, so a link opens the map there instead of on all the photos. A link with only an open photo (`?photo=<id>`) opens zoomed in on that photo instead, so it doesn't fly in from every photo; the homepage's map pin links straight to a photo's center and zoom. When those change from outside the map, as with the photo viewer's **View on map**, the map flies there. Moving replaces the URL rather than
adding to the history. The menu and other views' **View on map** open the map with no filters, so ones set on an earlier visit, or on another view, are gone; a link with filters in its URL keeps them (see [Portfolio Filters](portfolio-filters.md)). Changing a filter still fits the map to the photos it shows, and that's saved the same way.

> **Frontend analogy:** the grouping is done by MapLibre on the map's data, like a virtualized list deciding which
> rows to render: the page asks which groups and photos are in view after each move and draws a React marker for each.

The map fills the page. The title and photo count, the controls below, and the site menu in the top right corner all
float over it, and fitting the map leaves extra room at the top so photos aren't hidden under them. The map's zoom
buttons are in the bottom right corner.

Jumping somewhere (the zoom-out button, a filter that changes which photos show, or **View on map** from the
photo viewer while on the map) fades the map out, moves it there and fades it back in once it's drawn, rather than flying
out and back in (`fadeTo` in `lib/map-fade.ts`). Zooming into a group of photos still animates, as it's a short move.

Over the top left corner, beside the title on wider screens and under it on phones, in one row
(`components/map-controls.tsx`). On phones, **More filters**, **View in grid** and **Browse** are just their icons, so the row
fits without covering the map:

- **Places** comes first, with the icon button beside it that zooms back out to every photo. It opens the same columns as
  the [Places filter](portfolio-filters.md#places), without checkboxes, and it doesn't filter: picking a place (one with
  nothing in it, or **All of** at the top of a column, such as **All of Japan**) closes them and moves the map to that
  place's photos, the one place at a time, the way the
  zoom-out button moves it to every photo (`components/map-place-picker.tsx`). Its counts are out of the photos the
  other filters leave. A link with a place filter in its URL opens the map on every photo, as the map ignores it.
  Pointing at a place in the columns (or focusing it) shades its [area](places-and-localizations.md#areas) on the map,
  or a circle 80 m around its position when it has no area, and picking it keeps the area shaded, more faintly, until another place is picked
  (`components/place-area-layer.tsx`, `lib/place-areas.ts`). Each area is its own `places/<id>.geo.json` file,
  loaded the first time it's shown, so the map's page doesn't carry every outline. Areas are light blue (Tailwind's
  sky, standing in for the brand blue, apart from the walking lines' darker blue), with a darker edge in light mode
  and a lighter one in dark mode (`lib/map-theme.ts`, which the pipeline's trip line map shares, basemaps included).
- The eye button opens the map's **display options** (`components/map-display-options.tsx`, kept in
  `lib/map-display.ts`). It's the one display options button without the words "Display Options", since the map's
  floating controls have no room for them. The picks are in the left column and the checkboxes on the right:
  - **Grouping** is how close photos are, in pixels on the screen, before they're one round marker (MapLibre's
    `clusterRadius`, 40 by default at Medium pins, from 10 to 100). Less shows more photos on their own; set well
    below the pin size, groups can overlap each other. A small tick under the slider marks the default.
  - **Pin size** is Small, Medium (the default) or Large, for photo and group markers alike. Grouping scales with it
    (`clusterRadius` in `lib/map-display.ts`), and fewer photos are split out of a group at each zoom (`fanLimit`,
    shrinking with the room a pin takes), so big pins group sooner rather than being pushed far from their spots to
    keep from overlapping. Photos moved apart are kept a pin's width and a gap apart.
  - **Groups → Show counts** hides the number on group markers when unticked.
  - **Groups → Darken photos under counts**, when unticked, shows a group's photos as they are, with its count in a small dark
    badge instead.
  - **Groups show the latest** picks which three photos a group's marker fades through: **Added** (the default), the
    ones added to the portfolio last, or **Captured**, the ones taken last. Photos with no added date count as
    the oldest added.
  - **Trip lines → Show trip lines** (on by default) draws the [trip lines](#trip-lines) under the photos.
  - **Direction of travel** (off by default, shown while **Show trip lines** is on) shows the way each line was travelled
    like a ride app shows a route: a light runs along it from where it started to where it ended, over and over
    (`components/trip-flow-layer.tsx`). With the system's reduce motion setting on, each line instead brightens from
    its start to its end without moving.
  - **Reset to defaults** goes back to these defaults.

  These options, but for the group photos, are `components/pin-display-fields.tsx`, which the
  [Color page](portfolio-color.md) shares.

  They're remembered in this browser, like the theme, rather than in the URL, so they stay the same on the next visit
  without changing a shared link.

  > **Frontend analogy:** MapLibre can't change how a source groups its points once it's made, so changing
  > **Grouping** remounts the `<Source>` with a new `key`, like resetting a component's state by changing its key.

- **More filters** opens the **Groups**, **When** and **Visuals** pickers, side by side in one row (wrapping onto more
  rows on a phone), and shows how many of their filters are set. To see one day or a few, use When's **Date range**;
  the map fits itself to the photos it leaves, like any other filter. **View in grid** carries the Visuals filters to the
  Grid too.
- **View in grid** opens the Grid on the photos in view (`gridFiltersFor` in `lib/map-grid-link.ts`). It keeps the
  album, tag and genre filters and looks for the fewest countries, states, cities and places, biggest first, that show
  just those photos, so a view of Seoul opens `/grid?state=Seoul` and one of New York City `/grid?city=New York City`.
  When none fit, such as a city only partly in view or a date range that leaves out some of its photos, it chooses
  the photos one by one instead (`?ids=[…]`, see [Chosen photos](portfolio-filters.md#chosen-photos)). A place filter
  also shows that place's photos with no GPS position, which the map can't show. It can't be pressed while no photos
  are in view.
- **Browse** opens the photo viewer on the newest photo in view, and its arrows, keys and swipes step through every
  photo in view, newest first. Opening a photo's own marker steps through them the same way, starting on that photo;
  a group's grid still steps through just that group's photos. It can't be pressed while no photos are in view.
- Links from before the day dropdown moved into When, `?day=2026-05-01&to=2026-05-17` (such as the Timeline's route
  sketches), open on that date range, as `?start=2026-05-01&end=2026-05-17`; `to` can be left out for one day.

## Trip lines

Under the photos, the map draws the trip lines of the days its photos were taken, so the date range and the other
filters narrow them too (`components/trip-lines-layer.tsx`). They come from `triplines/TRIPLINES.geo.json`, which the
pipeline's Commit bakes (see [Trip lines](trip-lines.md#the-baked-map-triplinesgeojson)), loaded the first time the map
draws them (`lib/trip-lines-map.ts`):

- Walks are solid blue (lighter in dark mode).
- A hop along the bus, subway or train line it rode is solid in that line's color.
- A drive (`car`, such as a big jump the automatic line marks) is gray in long dashes.
- A [Trip](trip-lines.md#trips)'s ferry is a line of teal dots, and its flight a dashed pink arc. A leg shows with
  the photos of either the day it left or the day it arrived. The Timeline's route sketches leave legs out.
- Any other hop is dashed purple.
- Places visited are amber dots.
- Areas that photos without an exact spot were taken in are shaded light blue, like a place's area.

**Show trip lines** in the display options turns them off, and takes them out of the [key](#key) too. The lines, stations and areas come from OpenStreetMap data,
under the [ODbL](https://www.openstreetmap.org/copyright); the basemap's attribution (the ⓘ in the corner) already
credits OpenStreetMap's contributors, which covers them.

> **Frontend analogy:** the map reads a build artifact. The pipeline compiles each day's line into one GeoJSON file at
> Commit, and the portfolio only renders it, the way a static site renders prebuilt JSON instead of calling an API.

## Key

A **Key** panel in the map's bottom left corner explains what the map draws (`components/map-legend.tsx`). It lists
only the kinds of thing the map draws for its photos, whether or not they're in view (`lib/map-legend.ts`), so the
filters and the day filter change it:

- The pins: **Photo** (a square pin with a white edge), **Group of photos** (a round marker with its count, whenever
  there are at least two photos) and **Photo without an image yet** (a small light-blue dot). A (?) after **Group of
  photos** opens a note on clicking a group: a click zooms in, and ⌘-click (Ctrl-click off Apple devices, read from the
  browser's user agent in `lib/platform.ts`) lists its photos in a grid (`components/map-legend-help.tsx`).
- Then, under a divider, the trip lines of the photos' days when **Show trip lines** is on: **Walk**, **Bus, subway or
  train** (a sample in the colors of the lines ridden), **Drive** (long dashes), **Ferry**, **Flight**, **Other trip** (dashed), **Place visited** and **Area**.
  **Area** also shows while a place's area is shaded from **Places**.

The samples use the same colors as the map in light and dark mode (`lib/map-theme.ts`). The **Key** button folds the
panel down to itself; it starts open on wider screens and folded on phones, and is remembered in this browser.

> **Frontend analogy:** the key is derived state, like a filter chip list built from the current results. It reads the
> same trip line data and photos as the map's layers and keeps only the entries that would render something.
