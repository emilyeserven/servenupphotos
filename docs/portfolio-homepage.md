# Portfolio homepage

The portfolio's homepage (`/`, `apps/portfolio/src/routes/index.tsx`) is where a visitor picks a way to explore the
photos: one small tile for each view, with its icon and name, that's ready to visit (Timeline, Table, Map and Grid). A view is ready when its
entry in `apps/portfolio/src/lib/portfolio-views.ts` has `enabled: true`; the site menu greys out the others, and the
homepage leaves them out.

Behind the links, photos fill the screen and fade in and out one at a time, each for 7 seconds, under 60% black so the
text stays readable (`components/photo-backdrop.tsx`). The showing photo's title is at the bottom left. The photos are
the ones picked for the **Homepage** zone on the pipeline's [Site Spotlight](publish.md#site-spotlight) page, newest
first, or, with none picked, the 5 newest photos (`lib/homepage-photos.ts`). Only photos with resized versions in R2
are shown.

Only the showing photo and the ones on either side of it are on the page: the one before is still fading out, and the
one after loads ahead, so a long list doesn't load every photo at once. A photo fades in only once it has loaded. With
reduced motion turned on, the first photo just stays and nothing fades. The map's cluster markers turn through their
photos with the same hook, `lib/use-turn.ts`.

> **Frontend analogy:** it's a carousel with no controls: one `setInterval` bumps an index, and each `<img>` is stacked
> in the same spot with a CSS opacity transition, so changing which one has `opacity-100` is the whole cross-fade.
