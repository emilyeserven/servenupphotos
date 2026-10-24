# Portfolio Spotlight

The portfolio's Spotlight page (`/spotlight`, `apps/portfolio/src/routes/spotlight.tsx`) shows each spotlight zone of the
site, for now just **Homepage**, with a strip of the photos picked for it on the pipeline's
[Site Spotlight](publish.md#site-spotlight) page, in the same order (ones without a place after, newest first). Each
photo is as tall as the strip and as wide as its own shape, and the strip scrolls sideways when they don't fit
(`components/spotlight-strip.tsx`). Clicking a photo opens it in the [photo viewer](photo-viewer.md), which steps
through every spotlighted photo. A zone with none picked says so.

The zones and their photos come from `lib/spotlight-zones.ts`, which the [homepage](portfolio-homepage.md) uses too.
Adding a zone there (and to the pipeline's `lib/site-spotlight.ts`) adds its strip.
