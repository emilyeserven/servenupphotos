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
before `peakChroma` was added use their average for peak until Update Data's **Colors** reads them again. Photos
without `colors`, or without resized versions in R2, aren't shown; with none at all, the page shows its placeholder.

Clicking a photo opens the photo viewer (`?photo=`). Like the Map, the page fills the window with no scrolling, and its
title and controls float at the top left (`components/floating-header.tsx`, shared with the Map), over the page's
background; the wheel or chart starts below them, its top fading in from the background (a CSS mask on the board), and
the wheel starts a little further down still. The zoom buttons are at the bottom right. **Wheel / Black & white** picks
the view. **Display** (`components/color-display-menu.tsx`) holds **Preview size**: **Small**, **Medium** or **Large**
(`components/pin-size-control.tsx`, `lib/pin-scale.ts`) makes the pins 1×, 1.5× or 2× their usual size
(`?pins=medium`, `?pins=large`, left out for small); bigger pins cluster sooner. **Filters** opens the **Average / Peak**
and **Vividness at least** controls (`components/color-view-filters.tsx`), hidden at first and counted on the button
while changed. On this page **Peak** is the default (`?measure=average` picks average), since it spreads photos out
more. The Color page has no
grid of its own any more: the [Grid page](#on-the-grid-page) has the same color filters and sorts by color, and older
`/color?view=grid` links go there, sorted by color, keeping their color filters.

## Wheel

The **Wheel** (the default) shows the photos with color on a color wheel
(`components/color-wheel.tsx`, `lib/color-wheel.ts`), filling the whole page as an oval when it isn't square (the
colors are drawn as a circle and squashed the same way, so pins stay over their colors), brightest in the middle and
fading out into the page's background at the edge, with no caption under it, and with each photo as a thumbnail pin like the Map page's. A photo sits around the wheel by its
hue, red at the top and clockwise through orange and yellow: its biggest hue bucket, pulled toward its second biggest
along the shorter way round, the more the more of it there is (by the second's share of the two), so a photo with as
much orange as yellow sits halfway between them and one with a touch of yellow stays near orange (shades are left
out). It sits in toward the middle by its vividness, by the **Average / Peak** measure: the most vivid photo shown
(or 20, if none is more vivid) in the middle and gray photos at the faded edge. The hues are drawn at full strength, fading into the page only in the outer half of
the wheel, and the **Black & white** chart's grays are at full strength too. Pins that would overlap are pushed apart, a little at a time, until they don't
(`spreadPins`), so each stays as near its place as it can; with many photos on a small screen, the pins get smaller,
down to 14px, so they fit. Where three or more photos' places are within one and a half pin widths of each other,
they're one round cluster pin instead, like the Map page's, showing how many photos it covers over the first one's
thumbnail (`lib/wheel-clusters.ts`, `lib/pin-markers.ts`, `components/wheel-cluster-pin.tsx`). The zooming,
clustering and mini map are `components/pin-board.tsx`, which the Black & white chart shares. Clicking a cluster zooms in 2× on it, smoothly over about 0.7s (as the zoom buttons do; `lib/use-view-animation.ts`), so you can see where you are going, with the pins laid out for where it ends up and moving with the wheel as it zooms (at once with reduced motion), and
zooming in splits clusters apart, as the same places are further apart on a bigger wheel; at the furthest zoom
nothing is clustered, so every photo can be reached. The vividness filters narrow the wheel; the color swatches are
only on the Grid page now. Clicking a pin opens the photo viewer.

The wheel zooms in up to 8× with its **+** and **−** buttons, a two-finger pinch, or ctrl + scroll (a trackpad pinch),
and pans by dragging (`lib/use-wheel-zoom.ts`); the third button shows the whole wheel again. A drag that starts on a
pin doesn't open it. Pins stay the same size as it zooms, and are spread apart again for the bigger wheel, so zooming
in on a crowded patch separates them. Zoomed in, a mini map floating at the bottom left of the screen (`components/wheel-minimap.tsx`) shows the
whole wheel with a dot for each photo and a box around the part in view; clicking it moves the view there. The zoom
isn't kept in the URL. On a phone, one finger scrolls the page over the whole wheel and drags it once it's zoomed in.

## Black & white

**Black & white** (`?view=mono`, `components/shade-spectrum.tsx`) shows the photos whose blacks, grays and whites make
up at least 90% of them (`isBlackAndWhite` in `lib/photo-colors.ts`), which the wheel leaves out, as pins on a chart:
left to right from black to white by average lightness (`Photo.lightness`, the mean of its neutral histogram, 0 to
100), and bottom to top by vividness, by the **Average / Peak** measure, since even a black and white photo can have a
slight tint. The chart fits the photos: across from the darkest to the lightest one's lightness, rounded out to steps
of 5 (at least 10 wide; `lightnessExtent`), and up from the least vivid photo shown to the most (at least 2 apart), so
photos aren't bunched into one corner. Like the wheel, it fills the page below the floating controls, its gray
background fading in at the top, with no slider, axis labels or caption: the grays show which way is light. It's a pin
board like the wheel
(`components/pin-board.tsx`): pins that would overlap are pushed apart, kept inside the chart; crowded ones are
clustered; and it zooms, pans and shows a mini map the same way, splitting clusters as it zooms in.

The **Filters** vividness controls work here too. Older links' `?light=` range is ignored.

> **Frontend analogy:** the chart is a scatter plot of absolutely positioned buttons, `left` from lightness and `top`
> from vividness, then nudged apart like a physics-based layout until none overlap.

## Color filters

These are on the [Grid page](#on-the-grid-page); the Color page keeps only the vividness ones, behind **Filters**. The
swatches filter by one color (`?color=orange`, `?color=dark gray`; **All** clears it): the
12 hues, then the 5 shades after a divider. How a photo matches the color is picked under them (`lib/color-match.ts`),
and each swatch's tooltip says how many photos it shows that way. A swatch that would show none is crossed out with an
X and can't be picked, unless it's already the filter from a link, so it can still be cleared:

- **Largest color** (the default): the color is the biggest part of the photo.
- **At least…** (`?match=threshold`): the color is at least a share of the whole photo, 30% unless the slider beside
  it changes it, from 5% to 95% in steps of 5 (`?min=15`, left out at 30%; `DEFAULT_PERCENT` in `lib/color-search.ts`).

**Average / Peak** picks which vividness the views and the slider use (`?measure=peak`, left out for average, except
on the Color page, where peak is the default and left out). A
**Vividness at least** slider hides the photos less vivid than it, from 0 (every photo, left out of the URL) to 100
in steps of 5 (`?vivid=20`), and the swatches' counts only count the photos it leaves. These are read and applied in
`lib/color-search.ts`, which the Grid page shares.

## On the Grid page

The Grid's **Show filters** panel has a compact **Colors** box (`components/grid-color-filters.tsx`) in the camera
sliders' row, the same height as them: small swatches (picking the chosen one again clears it), the picked color's name,
an X clearing every color filter, and a **More** toggle opening the match and vividness controls below the swatches (open
from the start when one of them is set). It uses the same URL keys as above, counting the photos the Grid's other filters leave. Its
color and vividness filters count toward the filter button's number, and **Clear filters** clears them. Photos without
saved colors don't match a color or a vividness above 0. With **Show info** on, each tile also shows its color bar
(`components/color-bar.tsx`): each color as wide as its share, the biggest three named under it.

The Grid's sort dropdown has **Color** (`?sort=color`) and **Vividness** (`?sort=vivid`) after newest and oldest
(`lib/grid-sort.ts`, `lib/color-sort.ts`), each **Ascending** (the default) or **Descending** (`?order=desc`):

- **Color**, with no color picked: by each photo's largest color, nudged toward whichever neighboring color it has more
  of so the colors run smoothly into each other, and newest first where they tie. Ascending runs red, orange, yellow,
  green, blue and on to rose, then the photos that are mostly shades, from black to white; descending runs the other
  way. With a color picked, it sorts by that color's share instead: ascending puts the most of it first, descending
  the least.
- **Vividness**: ascending puts the least vivid first, descending the most vivid, by the measure picked.

**Then by** adds the other one as a secondary sort, with its own **Ascending** or **Descending**
(`?secondary=vivid` or `?secondary=color`, `?secondaryOrder=desc`). The main sort then groups the photos and the
secondary sorts within each group: a color sort groups by each photo's largest color (or, with a color picked, by
10% bands of its share), and a vividness sort groups by bands of 10 vividness points. Changing the sort clears it.
Photos without saved colors come after the rest, newest first.

> **Frontend analogy:** each photo's `colors` is precomputed like a build-time asset hash: the pipeline does the
> pixel work once, and the page only filters and sorts numbers it already has.
