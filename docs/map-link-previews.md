# Map Link Previews

The map's **Copy link** button (after **Browse**, just its icon on phones) copies a link that shows a picture of
the map when it's shared on social media or in a chat: the map's light style with the photo pins on it, titled such as
**Seoul on the map** and described as "24 photos in Seoul." Opening the link opens the map on that view.

The link is to a **map page**, built with the site, as GitHub Pages can only serve files that already exist. There's
one for every country, state, city and place on the Places page with photos on the map, such as `/maps/city/seoul/`,
`/maps/state/new-york/` or `/maps/place/<place id>/`, and one for the whole map, `/maps/all/`
(`src/lib/map-pages.ts`). **Copy link** picks the most specific one that the photos in view are all in: their place,
or else their city, state or country, or else the whole map when they're in more than one country or none are in
view. So the link shows the place being looked at, not exactly the view on the screen.

> **Frontend analogy:** link previews are made by bots that read a page's HTML but never run its JavaScript, and
> GitHub Pages sends the same `index.html` for every `/map?…` link. So like the
> [photo pages](photo-viewer.md#sharing-a-photo), each map page is the built `index.html` with its own `<head>`, plus
> one image, made at build time: static site generation for just the preview.

In the app, `routes/maps.$kind.$slug.tsx` and `routes/maps.all.tsx` redirect to `/map?lat=…&lng=…&zoom=…` with the
page's view (the same one its picture shows), or to `/map` for the whole map, which fits every photo.

## The picture

Each page's `preview.png` is 1200 × 630, the size link previews use, drawn as a 600 × 315 view of the map at twice the
pixels, like a phone's screen, so labels are readable once a chat shrinks it (`map-preview/render.ts`):

1. **The view** (`src/lib/map-preview-view.ts`): fitted to the page's photos with some room around them, no closer than
   street level (zoom 14), the zoom rounded down to a whole number.
2. **The tiles:** CARTO's Positron raster tiles at twice the pixels (`light_all/{z}/{x}/{y}@2x.png`), the raster
   version of the map's light style. They're decoded by a small PNG reader (`map-preview/png.ts`).
3. **The pins** (`map-preview/pins.ts`): every photo in view, not just the page's, grouped like the map (photos
   within 40 of the map's pixels of a group join it) and drawn like Medium pins with their white border and shadow: a
   single photo is a rounded square in **the photo's average color**, and a group is a dark circle with its count
   (`map-preview/digits.ts` draws the numbers as strokes).
4. **The credit:** "© OpenStreetMap contributors © CARTO" in the bottom right corner, as the map shows it, which
   CARTO's basemaps ask for ([CARTO basemap terms](https://carto.com/legal/basemap-terms/)). It's a PNG made once by
   `pnpm --filter @servenup/portfolio map-attribution` with a headless browser and kept in `map-preview/attribution.ts`,
   so the build needs no fonts.

> **Frontend analogy:** Node has no canvas, so the picture is drawn into a `Uint8Array` of pixels, like `ImageData`
> without the canvas, and each pin's edge is a distance function, the idea behind anti-aliased `border-radius`.

## When it's built

`mapPreviewPages` (`map-preview/pages.ts`) runs after the build only when `MAP_PREVIEWS=1`, which the **Deploy
portfolio** workflow sets, so `pnpm build` and CI stay quick. It writes `dist/maps/<kind>/<place>/index.html` and
`preview.png` for every page (about 200 now).

Drawn images and fetched tiles are kept in `apps/portfolio/node_modules/.cache/map-previews`, which the workflow
saves between deploys with `actions/cache`. An image's name is a hash of its view and the pins drawn in it, so a
deploy only draws the pages whose photos changed, and only fetches tiles it hasn't fetched before. An image missing a
tile isn't kept, so the next deploy tries again. Change `STYLE_VERSION` in `map-preview/pages.ts` to draw every image
again after changing how they look.

> **Frontend analogy:** the image cache is keyed by content, like a TanStack Query `queryKey`: the same view and the
> same pins give the same name, so it's drawn once.

To build them locally: `MAP_PREVIEWS=1 CARTO_KEY=<key> pnpm --filter @servenup/portfolio build`. Drawing them all
from an empty cache takes about half a minute plus the tiles' download.

## Setting it up

CARTO's raster tiles need an API key; without one they carry an "API key required" watermark. Keys are free for
non-commercial use up to 5 million tile requests a month
([CARTO basemap styles](https://github.com/CartoDB/basemap-styles), [API keys](https://www.carto.com/basemaps/apikey/)),
and a deploy fetches only the tiles it hasn't kept (about 2,000 the first time, few after). Add it as a repository
secret named `CARTO_KEY` under **Settings → Secrets and variables → Actions**. Until it's there, deploys skip the map
pages (with a warning in the build log): **Copy link** still copies `/maps/…/` addresses, which open the map on that
place through GitHub Pages' `404.html`, but they preview as the plain site.

## Tests

`pnpm --filter @servenup/portfolio test` runs the PNG reader and writer, the view math, the grouping, and a whole
picture drawn from fake tiles (`PREVIEW_OUT=/some/file.png` saves it to look at). CI runs them.
