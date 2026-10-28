# Portfolio homepage

The portfolio's homepage (`/`, `apps/portfolio/src/routes/index.tsx`) is where a visitor picks a way to explore the
photos: the site's name on frosted glass, then one small frosted tile for each view, with its icon and name, that's ready to visit (Timeline, Map and Grid). [Albums](portfolio-albums.md) and [Tags](portfolio-tags.md) are left off the homepage but are in the site menu. A view is ready when its
entry in `apps/portfolio/src/lib/portfolio-views.ts` has `enabled: true`; the site menu greys out the others, and the
homepage leaves them out.

Behind the links, photos fill the screen and fade in and out one at a time, each for 7 seconds, with no dark tint over them,
so the photo's colors show as they are; the frosted glass keeps the title and tiles readable (`components/photo-backdrop.tsx`). The
showing photo's title is at the bottom left on the same frosted glass (`components/backdrop-caption.tsx`), with a map pin
button before it, for photos with a position, that opens the [Map](portfolio-map.md) already zoomed in where the photo
was taken (`/map?lat=…&lng=…&zoom=…`, as the photo viewer's **View on map** link does). The title and button fade in and out with their photo, on the same
2-second fade, and can't be clicked or tabbed to while hidden. The photos are
the ones in the album picked for the **Homepage** zone on the pipeline's [Site Spotlight](publish.md#site-spotlight) page, sub-albums included, in the album's order, or, with no album picked, the 5 newest photos (`lib/homepage-photos.ts`, over the zones in `lib/spotlight-zones.ts`). Only photos with resized versions in R2
are shown.

On a phone held upright (`(max-width: 767px) and (orientation: portrait)`), portrait photos come first, each part
keeping its order; with no album picked, that's the 5 newest photos with portrait ones preferred. Each photo is cropped to
fill the screen around its **focus point**, set on the pipeline's Photo page (see [Site Spotlight](publish.md#site-spotlight)),
so a landscape photo on a phone or a portrait one on a computer keeps the part that matters in view. The point goes
where its **placement**, set there too, says on the screen: the middle by default, or for example the bottom middle.
The crop gets as near as the photo's edges allow; without a focus point, the photo's middle is used. It's worked out
from the photo's size and the screen's, measured as the window resizes (`objectPosition` in `lib/spotlight-focus.ts`).

The left and right arrow keys show the photo before or after, and the next one then waits its full 7 seconds again
(`lib/use-arrow-keys.ts`). Keys pressed while typing in a field, or with a modifier such as ⌘, are left alone.

Only the showing photo and the ones on either side of it are on the page: the one before is still fading out, and the
one after loads ahead, so a long list doesn't load every photo at once. The showing photo is fetched at high priority
and the one loading ahead at low priority, so the first photo isn't slowed down by the next. A photo fades in only once it has loaded. With
reduced motion turned on, the first photo stays until an arrow key moves on, and nothing fades. The map's cluster markers turn through their
photos with the same hook, `lib/use-turn.ts`.

> **Frontend analogy:** it's a carousel with no controls: one `setInterval` bumps an index, and each `<img>` is stacked
> in the same spot with a CSS opacity transition, so changing which one has `opacity-100` is the whole cross-fade.

> The focus point is CSS `object-position` on each `object-cover` image. Plain `30% 70%` would line the photo's point
> 30% across and 70% down up with the same spot on the screen; the position is worked out instead so the point lands
> at its placement, the middle by default, as the browser crops the rest.
