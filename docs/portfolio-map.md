# Portfolio Map

`/map` on the portfolio places every photo with a GPS position. It opens fitted to all of them, no closer than street
level, or on the whole world when there are none.

Each photo is a marker with its Square Thumbnail (or its Small version, cropped square), which opens the photo
viewer. Photos too close together to tell apart are one round marker with how many there are, over their three newest
photos fading in turn under a dark overlay. Clicking it opens a grid of their thumbnails above it, with **Zoom in**
to split them apart. Photos without resized versions are a small dot that opens their details instead.

A photo whose EXIF has no GPS position goes at one of its places' position (see
[Places](places-and-localizations.md#gps-position)). That spot is only near where it was taken, so its marker's white
border is softer, and so is a group's when every photo in it is placed that way. A place marked as an **Exact
location** on the Places page keeps the solid border for its photos.

Where the map is looking is kept in the URL as its center and zoom (`?lat=37.57&lng=126.98&zoom=12.5`), half a second
after it stops moving, so a link opens the map there instead of on all the photos. Moving replaces the URL rather than
adding to the history. Changing a filter still fits the map to the photos it shows, and that's saved the same way.

> **Frontend analogy:** the grouping is done by MapLibre on the map's data, like a virtualized list deciding which
> rows to render: the page asks which groups and photos are in view after each move and draws a React marker for each.

Over the top left corner:

- **All photos** goes back to the opening view.
- **New York City** and **Seoul** zoom straight to that area. The areas and their bounds are `MAP_AREAS` in
  `apps/portfolio/src/components/map-view-controls.tsx`; add one there to add a button.
- The **day** dropdown narrows the map to the photos taken on one day (`?day=2026-05-17` in the URL). It only lists
  the days of the photos in view, newest first with how many photos each has there, and updates as the map moves; a
  chosen day stays listed after moving away from its photos. Choosing a day doesn't move the map. It works alongside the
  location, album and tag filters, but the menu doesn't carry it to the other views.
- Once a day is chosen and another day is in view, a second **to** dropdown picks the last day of a range
  (`?day=2026-05-01&to=2026-05-17`), and the map shows every photo from the first day through the last. Either day can
  be the earlier one; the range is put in order. **Just this day** goes back to one day.
