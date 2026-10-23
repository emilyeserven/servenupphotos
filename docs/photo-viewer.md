# Photo Viewer

Clicking a photo on the portfolio's Grid, Timeline, Table or Map opens it in the photo viewer, a full-window overlay
with the photo as large as fits, its title, comment, settings, camera, date and place above it.

The open photo is kept in the URL by its ID (`?photo=12`, the `id` in its JSON; see
[Photo data](data-model.md#photo-ids)), so a link opens the page with that photo showing, next to the page's filters and
settings. Moving to another photo and closing the viewer replace the URL rather than adding to the history, so **Back**
leaves the page. The menu's links to the other views don't carry it. A photo opened from a link on the Map has no
neighbors, as the group it was opened from isn't in the URL.

For a photo the Map can place, from its EXIF GPS position or one of its places, **View on map**, at the bottom of the tooltip that hovering its place shows, opens
the Map centered on it (`/map?lat=…&lng=…&zoom=…`), at zoom 17, a few streets around it, or zoom 15 when its position
comes from a place and is only near where it was taken. The location, album and tag filters go along; the viewer closes.
On the Map itself, the map flies there. It's `ViewOnMapLink` in `apps/portfolio/src/components/view-on-map-link.tsx`.

> **Frontend analogy:** the open photo is router state, not component state: `useShownPhoto` in
> `apps/portfolio/src/lib/shown-photo.ts` reads `?photo=` with `useSearch` and sets it with `navigate`, like a modal
> route.

The **‹** and **›** buttons beside the photo, and the **Left** and **Right** arrow keys, move to the previous and next
photo in the order the page shows them, with where the photo is among them (such as "3 / 20") beside the close button.
They stop at the first and last photo rather than going round. Photos without resized versions in R2 are skipped.

| Page     | The photos it moves through                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Grid     | Every photo, in the chosen sort (newest or oldest first)                                                                 |
| Timeline | The photos in the chosen time range, newest first, as listed                                                             |
| Table    | Every row, in the table's current sort                                                                                   |
| Map      | The photos of the group whose grid it was opened from, oldest first; a photo opened from its own marker has no neighbors |

> **Frontend analogy:** the viewer doesn't know about sorting or filters. Each page hands it the same array it renders
> from, like passing a list's `items` to a carousel, and the viewer finds the open photo in it by id.

Each page passes `photos` and `onShow` to `PhotoLightbox` in `apps/portfolio/src/components/photo-lightbox.tsx`.

## Image loading

Every thumbnail on the portfolio (Grid tiles and their blurred placeholders, Timeline, Table, the Map's markers and
group grids) uses `loading="lazy"`, so the browser fetches it only when it scrolls near the screen. The viewer's photo
is the opposite: it's what the visitor just asked to see, so it loads straight away with `fetchPriority="high"`, over
its blurred preview. The pipeline's lists of photos (Gallery, Photos in Flight, the bucket and the pickers) are lazy
too; a page's one big photo, like the photo being read on the EXIF page, isn't.

> **Frontend analogy:** `loading="lazy"` is a built-in `IntersectionObserver` for images, and `fetchPriority` is like
> moving a request to the front of the network queue.
