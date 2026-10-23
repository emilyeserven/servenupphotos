# Portfolio Map

`/map` on the portfolio places every photo with a GPS position. It opens fitted to all of them, no closer than street
level, or on the whole world when there are none.

Each photo is a marker with its Square Thumbnail (or its Small version, cropped square), which opens the photo
viewer. Photos too close together to tell apart are one round marker with how many there are, over their three newest
photos fading in turn under a dark overlay. Clicking it opens a grid of their thumbnails above it, with **Zoom in**
to split them apart. Photos without resized versions are a small dot that opens their details instead.

A photo's [custom GPS position](places-and-localizations.md#custom-gps-position), written on the Photo page, wins over
its EXIF one. A photo with neither goes at one of its places' position (see
[Places](places-and-localizations.md#gps-position)). That spot is only near where it was taken, so its marker's white
border is softer, and so is a group's when every photo in it is placed that way. A place marked as an **Exact
location** on the Places page keeps the solid border for its photos.

Photos placed at the same place all sit on one spot, so zooming in never splits them apart. From zoom 16 in, a spot
with up to 12 photos scatters them loosely around it, the oldest nearest the middle, never overlapping, so each can be seen
and opened (`lib/map-fan.ts`, used by `markersInView` in `lib/map-markers.ts`). The scatter is random but seeded by the photos, so it's the same every time. A busier spot stays one group.

Where the map is looking is kept in the URL as its center and zoom (`?lat=37.57&lng=126.98&zoom=12.5`), half a second
after it stops moving, so a link opens the map there instead of on all the photos. When those change from outside the map, as with the photo viewer's **View on map**, the map flies there. Moving replaces the URL rather than
adding to the history. Changing a filter still fits the map to the photos it shows, and that's saved the same way. Unchoosing every place in the
Places filter (or clearing the filters while places were chosen) is the exception: the map stays where it is rather
than zooming out to every photo.

> **Frontend analogy:** the grouping is done by MapLibre on the map's data, like a virtualized list deciding which
> rows to render: the page asks which groups and photos are in view after each move and draws a React marker for each.

The map fills the page. The title and photo count, the controls below, and the site menu in the top right corner all
float over it, and fitting the map leaves extra room at the top so photos aren't hidden under them. The map's zoom
buttons are in the bottom right corner.

Over the top left corner, beside the title on wider screens and under it on phones:

On phones, the day, Places and album filters sit behind a **Filters** button next to **Jump to**, so they don't cover the
map. The button shows how many filters are set while they're hidden.

- **Jump to** is a dropdown that zooms straight to an area, for now New York City or Seoul. The areas and their bounds
  are `MAP_AREAS` in `apps/portfolio/src/components/map-view-controls.tsx`; add one there to add it to the dropdown. The
  icon button beside it zooms back out to every photo.
- The **day** dropdown narrows the map to the photos taken on one day (`?day=2026-05-17` in the URL). It only lists
  the days of the photos in view, newest first with how many photos each has there, and updates as the map moves; a
  chosen day stays listed after moving away from its photos. Choosing a day doesn't move the map. It works alongside the
  Places, album and tag filters (always shown after it, each in its own box, rather than behind **Show filters**), but the menu doesn't carry it to the other views.
- Once a day is chosen and another day is in view, a second **to** dropdown picks the last day of a range
  (`?day=2026-05-01&to=2026-05-17`), and the map shows every photo from the first day through the last. Either day can
  be the earlier one; the range is put in order. **Just this day** goes back to one day.
