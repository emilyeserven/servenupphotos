# Photo Viewer

Clicking a photo on the portfolio's Grid, Timeline, Table or Map opens it in the photo viewer, a full-window overlay
with the photo as large as fits, its title, comment, settings, camera, date and place above it.

The open photo is kept in the URL by its ID (`?photo=12`, the `id` in its JSON; see
[Photo data](data-model.md#photo-ids)), so a link opens the page with that photo showing, next to the page's filters and
settings. Moving to another photo and closing the viewer replace the URL rather than adding to the history, so **Back**
leaves the page. The menu's links to the other views don't carry it. A photo opened from a link on the Map has no
neighbors, as the group it was opened from isn't in the URL.

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
