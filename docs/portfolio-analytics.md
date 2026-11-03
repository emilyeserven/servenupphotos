# Portfolio analytics

The published portfolio counts visits with [Umami Cloud](https://umami.is/), a cookie-free analytics service. The
script tag is in `apps/portfolio/index.html`, so every page the portfolio serves loads it.

## What it covers

- **Every view of the app.** The portfolio is a single-page app, so moving from `/grid` to `/map` doesn't load a new
  page. Umami's script listens for the browser's history changes (`pushState` and `replaceState`), which is how
  TanStack Router changes the URL, and counts each one as a page view. Nothing in the app needs to call it.
  ([Umami tracker docs](https://umami.is/docs/tracker-configuration))
- **Photo pages** (`/photos/<id>/`, see [photo-viewer.md](photo-viewer.md)) and map pages (`/maps/…/`) are copies of
  the built `index.html` with their own preview tags, so they carry the script too. A visit that arrives from a
  shared link is counted under that page's path, then under the app's URL after it opens the photo or view.
- **Only the real site.** `data-domains="servenupphotos.net"` tells the script to stay quiet on any other host, so
  `pnpm dev`, `vite preview` and `pnpm shot` don't add visits. The pipeline doesn't load the script.

> **Frontend analogy:** it's like a global `useEffect` on the router's location that sends a beacon on each change,
> except Umami wraps `history.pushState` itself, so it works without any React code.

The site's ID (`data-website-id`) is public by design; it only says which Umami site the visits belong to. The
numbers are on the Umami Cloud dashboard.
