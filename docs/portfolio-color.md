# Portfolio Color

The portfolio's Color page (`/color`) shows the photos by their colors. It isn't linked yet: the menu lists it greyed
out and the homepage leaves it out (`enabled: false` in `apps/portfolio/src/lib/portfolio-views.ts`), so it's only
reached by typing its URL.

It reads each photo's `colors`, which the pipeline saves (see [Data model](data-model.md)), and only the 12 hue
buckets: blacks, grays and whites are left out for now. A photo's hues are worked out in `lib/photo-colors.ts` as
shares of its colored pixels only, so they add up to 100% (`Photo.hues`, biggest first). Photos without `colors`, or
without resized versions in R2, aren't shown; with none at all, the page shows its placeholder.

Under each square thumbnail, a bar shows its hues, each as wide as its share, with the biggest three named under it.
Clicking a photo opens the photo viewer (`?photo=`).

The swatches at the top filter by one hue bucket (`?hue=orange`; **All** clears it). A photo shows under a hue when at
least 15% of its colors are in it (`MIN_SHARE` in `routes/color.tsx`), the most first; without a filter, the newest
photos come first. Each swatch's tooltip says how many photos it shows.

> **Frontend analogy:** each photo's `colors` is precomputed like a build-time asset hash: the pipeline does the
> pixel work once, and the page only filters and sorts numbers it already has.
