# Portfolio Color

The portfolio's Color page (`/color`) shows the photos by their colors. It's in the menu and on the homepage
(`apps/portfolio/src/lib/portfolio-views.ts`).

It reads each photo's `colors`, which the pipeline saves (see [Data model](data-model.md)): its 12 hue buckets and the
lightness histogram of its blacks, grays and whites. The histogram is split into five shades by CIELAB lightness, a
fifth each: **black** (under 20), **dark gray**, **gray**, **light gray** and **white** (80 and up). A photo's colors
are worked out in `lib/photo-colors.ts` as shares of the whole photo, so the 12 hues and 5 shades add up to 100%
(`Photo.palette`, biggest first). Its **vividness** is its saved mean CIELAB chroma, rounded (`Photo.vividness`): 0 for
a gray photo, about 20 to 30 for an ordinary colorful one, and 50 or more for a very vivid one. Its **peak vividness**
is its saved `peakChroma`, the chroma its most vivid tenth reaches (`Photo.peakVividness`), so a mostly muted photo
with a small vivid part, such as a red door on a gray street, scores high on peak but low on average. Photos saved
before `peakChroma` was added use their average for peak until Update Data's **Colors** reads them again. Photos without `colors`, or without resized versions in R2, aren't shown; with none
at all, the page shows its placeholder.

Under each square thumbnail, a bar shows its colors, each as wide as its share, with the biggest three named under it,
and its vividness and peak vividness.
Clicking a photo opens the photo viewer (`?photo=`).

The swatches at the top filter by one color (`?color=orange`, `?color=dark gray`; **All** clears it): the 12 hues,
then the 5 shades after a divider. Photos are sorted by **Color** (the default) or **Vividness** (`?sort=vivid`), each **Ascending** (the default) or
**Descending** (`?order=desc`), in `lib/color-sort.ts`:

- **Color**, with **All**: by each photo's largest color, nudged toward whichever neighboring color it has more of so
  the colors run smoothly into each other, and newest first where they tie. Ascending runs red, orange, yellow,
  green, blue and on to rose, then the photos that are mostly shades, from black to white; descending runs the other
  way. With a color picked, it sorts by that color's share instead: ascending puts the most of it first, descending
  the least.
- **Vividness**: ascending puts the least vivid first, descending the most vivid, with a color picked or not, by
  the measure picked below.

**Then by** adds the other one as a secondary sort, with its own **Ascending** or **Descending**
(`?secondary=vivid` or `?secondary=color`, `?secondaryOrder=desc`). The main sort then groups the photos and the
secondary sorts within each group: a color sort groups by each photo's largest color (or, with a color picked, by
10% bands of its share), and a vividness sort groups by bands of 10 vividness points. Changing the main sort clears it.

**Average / Peak** picks which vividness the sort and the slider use (`?measure=peak`, left out for average). A
**Vividness at least** slider hides the photos less vivid than it, from 0 (every photo, left out of the URL) to 100
in steps of 5 (`?vivid=20`), and the swatches' counts only count the photos it leaves.

**Grid / Wheel** (`?view=wheel`) switches the photos from the grid to a color wheel (`components/color-wheel.tsx`,
`lib/color-wheel.ts`), with each photo as a thumbnail pin like the Map page's. A photo sits around the wheel by its
hue, red at the top and clockwise through orange and yellow: the average of its hue buckets around the wheel, each
weighted by its share, so a photo half orange and half yellow sits between them (its shades are left out). It sits out
from the gray middle by its vividness, by the **Average / Peak** measure, with the most vivid photo shown at the edge
(or 20, if none is more vivid). The swatches, the match and the vividness slider narrow the wheel as they do the grid;
the sort is hidden, since the wheel places photos itself. Clicking a pin opens the photo viewer.

Under the swatches, how a photo matches the color is picked (`lib/color-match.ts`), and each swatch's
tooltip says how many photos it shows that way:

- **Largest color** (the default): the color is the biggest part of the photo.
- **At least…** (`?match=threshold`): the color is at least a share of the whole photo, 30% unless the slider beside
  it changes it, from 5% to 95% in steps of 5 (`?min=15`, left out at 30%; `DEFAULT_PERCENT` in `routes/color.tsx`).

> **Frontend analogy:** each photo's `colors` is precomputed like a build-time asset hash: the pipeline does the
> pixel work once, and the page only filters and sorts numbers it already has.
