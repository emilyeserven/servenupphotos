# Portfolio analytics

The published portfolio counts visits with [Umami Cloud](https://umami.is/), a cookie-free analytics service. The
script tag is in `apps/portfolio/index.html`, so every page the portfolio serves loads it.

## What it covers

- **One page view per page.** The portfolio writes almost every control to the URL's query: filters, sorting,
  view modes, the photo open in the lightbox, the map's position. Umami's automatic tracking counted each of those
  URL changes as a page view, so one visit to the Grid could count dozens of times. The script now has
  `data-auto-track="false"`, and `src/lib/page-views.ts` sends a page view only when the path changes (`/grid` to
  `/map`, say). The view's URL includes the query the page opened with, so Umami's query parameter report still
  shows how people arrive.
- **Queries as events.** A change to the query alone is sent as a custom event named `query`, with `page` and each
  query value as properties (`sort`, `photo`, `album`, …). It waits until the query has stayed the same for two
  seconds, so dragging a slider or panning the map sends one event, not one per step. Explore them on Umami's
  **Events** tab: pick `query`, then break it down by a property to see, for example, which sorts or albums people
  choose. ([Umami event data](https://umami.is/docs/event-data))
- **Photo pages** (`/photos/<id>/`, see [photo-viewer.md](photo-viewer.md)) and map pages (`/maps/…/`) are copies of
  the built `index.html` with their own preview tags, so they carry the script too. A visit that arrives from a
  shared link is counted under that page's path, then under the app's URL after it opens the photo or view.
- **Only the real site.** `data-domains="servenupphotos.net"` tells the script to stay quiet on any other host, so
  `pnpm dev`, `vite preview` and `pnpm shot` don't add visits. The pipeline doesn't load the script.

> **Frontend analogy:** `trackPageViews` is a global `useEffect` on the router's location: it compares
> `location.pathname` with the last one it saw, and sends a beacon only when that changes. The query event is a
> debounced effect on `location.search`.

To keep your own visits out of the numbers, run `localStorage.setItem("umami.disabled", 1)` in the browser console
on servenupphotos.net. Umami skips that browser from then on.

The site's ID (`data-website-id`) is public by design; it only says which Umami site the visits belong to. The
numbers are on the Umami Cloud dashboard.
