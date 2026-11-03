# Map Link Previews

A link to the portfolio's map, such as `https://servenupphotos.net/map?lat=37.57&lng=126.98&zoom=12.5`, shows a picture
of that part of the map as its preview when it's shared on social media or in a chat: the map's light style with the
photo pins on it, titled **Map · Serven Up Photos** and described as how many photos are in view ("34 photos in this
part of the map."). A map link without a center and zoom shows every photo, as the map opens on them.

A link to any page with an open photo, such as `/timeline?thumbs=large&photo=512` or `/grid?photo=12`, shows that
photo as its preview, the same as its photo page at `/photos/<id>/` (see
[Sharing a photo](photo-viewer.md#sharing-a-photo)). When a map link has both, the photo wins.

Both are done by a Cloudflare Worker in front of the site, `apps/map-preview-worker`, so they only work once it's set
up (below). Without it the site works as before, and these links preview as the plain site.

> **Frontend analogy:** link previews come from bots that read a page's HTML but never run its JavaScript, and GitHub
> Pages sends the same `index.html` for every map link, whatever comes after the `?`. The Worker is like a service
> worker that runs on Cloudflare instead of in the browser: it sees each request before GitHub Pages does, and for
> these links adds the `<meta>` tags to the HTML on its way back.

## What the Worker does

Every request to `servenupphotos.net` goes through it (`src/index.ts`):

- **A page with `?photo=<id>`:** it reads the title and the Open Graph and Twitter tags from the photo's page,
  `/photos/<id>/`, and puts them in the page asked for, with `og:url` set to the link itself (`src/tags.ts`). A photo
  with no page (no ID or Medium version yet) leaves the page as it is.
- **`/map`:** it adds tags pointing `og:image` at `/og/map.png?lat=…&lng=…&zoom=…&v=…`, a 1200 × 630 image of the view.
- **`/og/map.png`:** it answers with that image (`src/map.ts`).
- **Anything else** (files, other pages) goes to GitHub Pages untouched. If the Worker fails, the request goes to
  GitHub Pages too (`passThroughOnException`).

Every app route is GitHub Pages' "not found" page (`404.html`, a copy of `index.html`), so a page the Worker adds tags to
is sent as found (200), since link preview bots skip pages that aren't.

### Drawing the map image

Workers have no canvas or fonts, so the image is drawn pixel by pixel (`src/render.ts`):

1. **The view** (`src/view.ts`): the link's center and zoom, with the same limits as the map, rounded so links that
   look nearly the same share one image: the center to 4 decimal places (about 10 meters), and the zoom down to a whole
   number, so the image never shows less than the link. It's drawn as a 600 × 315 view of the map at twice the
   pixels, like a phone's screen, so labels are readable once a chat shrinks the preview. The closest it zooms is 17.
2. **The tiles:** CARTO's Positron raster tiles, with the `CARTO_KEY` secret as their `?key=`, at twice the pixels (`light_all/{z}/{x}/{y}@2x.png`), the raster
   version of the map's light style, fetched all at once and kept in Cloudflare's cache for a week. A tile that can't be
   fetched leaves its square blank. They're decoded by a small PNG reader (`src/png.ts`) using the runtime's own zlib.
3. **The pins** (`src/pins.ts`): every photo the map would show, grouped like the map (photos within 40 of the map's
   pixels of a group join it) and drawn like Medium pins with their white border and shadow: a single photo is a
   rounded square in **the photo's average color** (the Worker can't decode the WEBP thumbnails), and a group is a dark
   circle with its count (`src/digits.ts` draws the numbers as strokes).
4. **The credit:** "© OpenStreetMap contributors © CARTO" in the bottom right corner, as the map shows it, which
   CARTO's free basemaps ask for ([CARTO basemap terms](https://carto.com/legal/basemap-terms/)). It's a PNG made once by
   `scripts/make-attribution.mjs` with a headless browser and kept in `src/attribution.ts`.

> **Frontend analogy:** drawing into a `Uint8Array` of pixels is `ImageData` without the canvas, and each pin's edge is
> a distance function, the idea behind CSS `border-radius` anti-aliasing.

### Where the pins come from

Each portfolio build writes `map-pins.json` next to `index.html` (`mapPins` in `apps/portfolio/map-pins.ts`): every
photo with a map position as `[longitude, latitude, averageColor]`. It reads the photos through `src/lib/photos.ts`,
like the map, so custom GPS positions and place positions count, and photos with no date are left out. Filters in a map
link (albums, tags, days) aren't applied to the preview.

### Keeping each image

The first request for a view draws its image and saves it to the R2 bucket `servenup-map-previews` after answering;
later requests read it from there. Its key is the rounded view plus a fingerprint of `map-pins.json`
(`v1/<pins>/<zoom>/<lat>/<lng>.png`), so new photos give every view a new image (and a new `v=` in `og:image`, so link
preview services fetch it again). Change `STYLE_VERSION` in `src/map.ts` to draw every image again after changing how
they look. Old images are never read again; an R2 lifecycle rule can delete them after 30 days.

> **Frontend analogy:** the key works like a TanStack Query `queryKey`: the same view and the same photos give the
> same key, so the image is drawn once and served from R2 after that.

## Setting it up

The `servenupphotos.net` zone is already on Cloudflare (R2's `cdn.servenupphotos.net` needs it). Run the `wrangler`
commands from `apps/map-preview-worker`. One-time steps:

1. **Workers plan.** Drawing an image takes about 100 to 200 ms of CPU, more than the Free plan's 10 ms limit, so the
   Worker needs **Workers Paid** ($5 a month, which includes 10 million requests)
   ([limits](https://developers.cloudflare.com/workers/platform/limits/),
   [pricing](https://developers.cloudflare.com/workers/platform/pricing/)). Waiting on tiles doesn't count, and
   images already in R2 and the HTML tags take far less.
2. **CARTO API key.** CARTO's raster tiles now need a key; without one they carry an "API key required" watermark. Keys
   are free for non-commercial use up to 5 million tile requests a month, and each view only fetches its tiles once
   ([CARTO basemap styles](https://github.com/CartoDB/basemap-styles),
   [API keys](https://www.carto.com/basemaps/apikey/)). Store it as a secret:
   `pnpm dlx wrangler@4.150.0 secret put CARTO_KEY`.
3. **R2 bucket.** `pnpm dlx wrangler@4.150.0 r2 bucket create servenup-map-previews`, or create it in the dashboard
   under **R2**. Optionally add a lifecycle rule to delete objects after 30 days.
4. **Send the site through Cloudflare.** In **DNS → Records**, turn the proxy on (orange cloud) for the apex
   `servenupphotos.net` records that point at GitHub Pages, after GitHub's HTTPS certificate is issued (**Enforce
   HTTPS** on), and set **SSL/TLS → Overview** to **Full (strict)**. GitHub can't issue a certificate while the proxy
   hides its DNS records; if one ever fails to renew, turn the proxy off until it's reissued
   ([GitHub Community discussion](https://github.com/orgs/community/discussions/22790)).
5. **Deploy.** `pnpm --filter @servenup/map-preview-worker run deploy` (it asks to log in to Cloudflare the first
   time). `wrangler.toml` routes `servenupphotos.net/*` to the Worker and binds the bucket. Deploy again after changing
   anything in `apps/map-preview-worker`; portfolio deploys don't need it.
6. **Check it** with a link preview debugger, such as [opengraph.xyz](https://www.opengraph.xyz/) or Facebook's
   [Sharing Debugger](https://developers.facebook.com/tools/debug/), on a map link and a `?photo=` link.

To run it locally against the built site: `pnpm --filter @servenup/portfolio build`, serve `apps/portfolio/dist` (for
example `python3 -m http.server 8788` in it), then
`pnpm --filter @servenup/map-preview-worker run dev --local-upstream localhost:8788 --var SITE_ORIGIN:http://localhost:8788`
and open `http://localhost:8787/map`. R2 is simulated locally.

## Tests

`pnpm --filter @servenup/map-preview-worker test` runs the PNG reader and writer, the view math, the grouping, and a
whole image drawn from fake tiles (`PREVIEW_OUT=/some/file.png` saves it to look at). CI runs them.
