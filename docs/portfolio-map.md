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
