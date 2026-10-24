# Portfolio Color

The portfolio's Color page (`/color`) shows the photos by their colors. It isn't linked yet: the menu lists it greyed
out and the homepage leaves it out (`enabled: false` in `apps/portfolio/src/lib/portfolio-views.ts`), so it's only
reached by typing its URL.

It reads each photo's `colors`, which the pipeline saves (see [Data model](data-model.md)): its 12 hue buckets and the
lightness histogram of its blacks, grays and whites. The histogram is split into five shades by CIELAB lightness, a
fifth each: **black** (under 20), **dark gray**, **gray**, **light gray** and **white** (80 and up). A photo's colors
are worked out in `lib/photo-colors.ts` as shares of the whole photo, so the 12 hues and 5 shades add up to 100%
(`Photo.palette`, biggest first). Photos without `colors`, or without resized versions in R2, aren't shown; with none
at all, the page shows its placeholder.

Under each square thumbnail, a bar shows its colors, each as wide as its share, with the biggest three named under it.
Clicking a photo opens the photo viewer (`?photo=`).

The swatches at the top filter by one color (`?color=orange`, `?color=dark gray`; **All** clears it), the photos with
the most of it first: the 12 hues, then the 5 shades after a divider. With **All**, every photo is sorted by color
(`lib/color-sort.ts`): by its largest color, nudged toward whichever neighboring color it has more of so the colors run
smoothly into each other, and newest first where they tie. **Ascending** (the default) runs red, orange, yellow, green,
blue and on to rose, then the photos that are mostly shades, from black to white; **Descending** (`?order=desc`) runs
the other way. Under the swatches, how a photo matches the color is picked (`lib/color-match.ts`), and each swatch's
tooltip says how many photos it shows that way:

- **Largest color** (the default): the color is the biggest part of the photo.
- **At least…** (`?match=threshold`): the color is at least a share of the whole photo, 30% unless the slider beside
  it changes it, from 5% to 95% in steps of 5 (`?min=15`, left out at 30%; `DEFAULT_PERCENT` in `routes/color.tsx`).

> **Frontend analogy:** each photo's `colors` is precomputed like a build-time asset hash: the pipeline does the
> pixel work once, and the page only filters and sorts numbers it already has.
