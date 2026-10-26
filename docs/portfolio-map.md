# Portfolio Map

`/map` on the portfolio places every photo with a GPS position. It opens fitted to all of them, no closer than street
level, or on the whole world when there are none.

Each photo is a marker with its Square Thumbnail (or its Small version, cropped square), which opens the photo
viewer. Photos too close together to tell apart (within 40 pixels by default, a little under a marker's width; see **display options** below) are one round marker with how many there are, over their three newest
photos fading in turn under a dark overlay. Clicking it zooms the map in to fit its photos, which splits it apart, like
a cluster pin on the Color page's wheel. A group that zooming in can't split (photos at one spot, or the map already as
close as it goes) opens a grid of their thumbnails instead: in a popup above it, or on phones in a sheet along the
bottom of the map, so it's never cut off at the top of the screen or hidden under the floating header
(`components/map-cluster.tsx`). Photos without resized versions are a small dot that opens their details instead.

A photo's [custom GPS position](places-and-localizations.md#custom-gps-position), written on the Photo page, wins over
its EXIF one. A photo with neither goes at one of its places' position (see
[Places](places-and-localizations.md#gps-position)). That spot is only near where it was taken, so its marker's white
border is softer, and so is a group's when every photo in it is placed that way. A place marked as an **Exact
location** on the Places page keeps the solid border for its photos. Like every view, the map leaves out a photo with no date, EXIF or [custom](data-model.md#date-taken), even when it has a position.

From city zoom (12) in, small groups split into photos of their own, so a sparse area shows each photo rather than a
count: up to 3 photos at zoom 12, growing to 12 by zoom 16 (`fanLimit` in `lib/map-fan.ts`). Bigger groups stay one
marker until closer. Each photo then sits on its own spot when there's room. When it would overlap another marker, such
as photos placed at the same place, it's moved a little to a random spot nearby that's clear, the oldest photos placed
first so they stay nearest their spots (`fanOffsets`, used by `markersInView` in `lib/map-markers.ts`). The randomness
is seeded by each photo's ID, so it lands in the same place every time.

Where the map is looking is kept in the URL as its center and zoom (`?lat=37.57&lng=126.98&zoom=12.5`), half a second
after it stops moving, so a link opens the map there instead of on all the photos. A link with only an open photo (`?photo=<id>`) opens zoomed in on that photo instead, so it doesn't fly in from every photo; the homepage's map pin links straight to a photo's center and zoom. When those change from outside the map, as with the photo viewer's **View on map**, the map flies there. Moving replaces the URL rather than
adding to the history. The menu and other views' **View on map** open the map with no filters, so ones set on an earlier visit, or on another view, are gone; a link with filters in its URL keeps them (see [Portfolio Filters](portfolio-filters.md)). Changing a filter still fits the map to the photos it shows, and that's saved the same way. Unchoosing every place in the
Places filter (or clearing the filters while places were chosen) is the exception: the map stays where it is rather
than zooming out to every photo.

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

- **Places** comes first, with the icon button beside it that zooms back out to every photo. The United States of
  America starts expanded, so its states show without a click (see
  [Portfolio Filters](portfolio-filters.md#places)).
- The eye button opens the map's **display options** (`components/map-display-options.tsx`, kept in
  `lib/map-display.ts`):
  - **Grouping** is how close photos are, in pixels on the screen, before they're one round marker (MapLibre's
    `clusterRadius`, 40 by default, from 10 to 100). Less shows more photos on their own; set below the pin size,
    groups can overlap each other.
  - **Pin size** is Small, Medium (the default) or Large, for photo and group markers alike; photos moved apart so they
    don't overlap are kept that much further apart.
  - **Show counts on groups** hides the number on group markers when unticked.
  - **Darken photos under counts**, when unticked, shows a group's photos as they are, with its count in a small dark
    badge instead.
  - **Reset to defaults** goes back to these defaults.

  They're remembered in this browser, like the theme, rather than in the URL, so they stay the same on the next visit
  without changing a shared link.

  > **Frontend analogy:** MapLibre can't change how a source groups its points once it's made, so changing
  > **Grouping** remounts the `<Source>` with a new `key`, like resetting a component's state by changing its key.

- **More filters** opens the day dropdowns (below), then the album, tag and genre dropdowns, and shows how many of them
  are set.
- **View in grid** opens the Grid on the photos in view (`gridFiltersFor` in `lib/map-grid-link.ts`). It keeps the
  album, tag and genre filters and looks for the fewest countries, states, cities and places, biggest first, that show
  just those photos, so a view of Seoul opens `/grid?state=Seoul` and one of New York City `/grid?city=New York City`.
  When none fit, such as a city only partly in view or a day filter that leaves out some of its photos, it chooses
  the photos one by one instead (`?ids=[…]`, see [Chosen photos](portfolio-filters.md#chosen-photos)). A place filter
  also shows that place's photos with no GPS position, which the map can't show. It can't be pressed while no photos
  are in view.
- **Browse** opens the photo viewer on the newest photo in view, and its arrows, keys and swipes step through every
  photo in view, newest first. Opening a photo's own marker steps through them the same way, starting on that photo;
  a group's grid still steps through just that group's photos. It can't be pressed while no photos are in view.
- The **day** dropdown, in **More filters**, narrows the map to the photos taken on one day (`?day=2026-05-17` in the URL). It only lists
  the days of the photos in view, newest first with how many photos each has there, and updates as the map moves; a
  chosen day stays listed after moving away from its photos. Choosing a day doesn't move the map. It works alongside the
  Places, album and tag filters, but the menu doesn't carry it to the other views.
- Once a day is chosen and another day is in view, a second **to** dropdown picks the last day of a range
  (`?day=2026-05-01&to=2026-05-17`), and the map shows every photo from the first day through the last. Either day can
  be the earlier one; the range is put in order. **Just this day** goes back to one day.
