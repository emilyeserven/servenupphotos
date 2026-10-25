# Portfolio Map

`/map` on the portfolio places every photo with a GPS position. It opens fitted to all of them, no closer than street
level, or on the whole world when there are none.

Each photo is a marker with its Square Thumbnail (or its Small version, cropped square), which opens the photo
viewer. Photos too close together to tell apart (within 40 pixels, a little under a marker's width) are one round marker with how many there are, over their three newest
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
adding to the history. Changing a filter still fits the map to the photos it shows, and that's saved the same way. Unchoosing every place in the
Places filter (or clearing the filters while places were chosen) is the exception: the map stays where it is rather
than zooming out to every photo.

> **Frontend analogy:** the grouping is done by MapLibre on the map's data, like a virtualized list deciding which
> rows to render: the page asks which groups and photos are in view after each move and draws a React marker for each.

The map fills the page. The title and photo count, the controls below, and the site menu in the top right corner all
float over it, and fitting the map leaves extra room at the top so photos aren't hidden under them. The map's zoom
buttons are in the bottom right corner.

Jumping somewhere (**Jump to**, the zoom-out button, a filter that changes which photos show, or **View on map** from the
photo viewer while on the map) fades the map out, moves it there and fades it back in once it's drawn, rather than flying
out and back in (`fadeTo` in `lib/map-fade.ts`). Zooming into a group of photos still animates, as it's a short move.

Over the top left corner, beside the title on wider screens and under it on phones:

On phones, the day, Places and album filters sit behind a **Filters** button next to **Jump to**, so they don't cover the
map. The button shows how many filters are set while they're hidden.

- **Jump to** is a dropdown that zooms straight to an area, for now New York City, Seoul or Japan. The areas and their
  bounds are `MAP_AREAS` in `apps/portfolio/src/components/map-view-controls.tsx`; add one there to add it to the
  dropdown. A country (`countryArea`) fits the photos taken there, by their country, rather than the whole country, so
  Japan shows the west of Japan where the photos are; it's left out while there are none. The icon button beside it
  zooms back out to every photo.
- **Places** is always shown, and the album, tag and genre dropdowns sit behind **More filters** beside it, which
  shows how many of them are set.
- **View in grid** opens the Grid on the photos in view (`gridFiltersFor` in `lib/map-grid-link.ts`). It keeps the
  album, tag and genre filters and looks for the fewest countries, states, cities and places, biggest first, that show
  just those photos, so a view of Seoul opens `/grid?state=Seoul` and one of New York City `/grid?city=New York City`.
  When none fit, such as a city only partly in view or a day filter that leaves out some of its photos, it chooses
  the photos one by one instead (`?ids=[…]`, see [Chosen photos](portfolio-filters.md#chosen-photos)). A place filter
  also shows that place's photos with no GPS position, which the map can't show. It can't be pressed while no photos
  are in view.
- The **day** dropdown narrows the map to the photos taken on one day (`?day=2026-05-17` in the URL). It only lists
  the days of the photos in view, newest first with how many photos each has there, and updates as the map moves; a
  chosen day stays listed after moving away from its photos. Choosing a day doesn't move the map. It works alongside the
  Places, album and tag filters (shown after it rather than behind **Show filters**), but the menu doesn't carry it to the other views.
- Once a day is chosen and another day is in view, a second **to** dropdown picks the last day of a range
  (`?day=2026-05-01&to=2026-05-17`), and the map shows every photo from the first day through the last. Either day can
  be the earlier one; the range is put in order. **Just this day** goes back to one day.
