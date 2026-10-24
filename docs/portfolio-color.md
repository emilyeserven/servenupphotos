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

The swatches at the top filter by one hue bucket (`?hue=orange`; **All** clears it), the photos with the most of it
first; without a filter, the newest photos come first. Under the swatches, how a photo matches the hue is picked
(`lib/color-match.ts`), and each swatch's tooltip says how many photos it shows that way:

- **Largest color** (the default): the hue is the biggest of the photo's colors.
- **At least…** (`?match=threshold`): the hue is at least a share of the photo's colors, 30% unless the slider beside
  it changes it, from 5% to 95% in steps of 5 (`?min=15`, left out at 30%; `DEFAULT_PERCENT` in `routes/color.tsx`).

> **Frontend analogy:** each photo's `colors` is precomputed like a build-time asset hash: the pipeline does the
> pixel work once, and the page only filters and sorts numbers it already has.
