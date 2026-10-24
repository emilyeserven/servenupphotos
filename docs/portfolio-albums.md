# Portfolio Albums

The portfolio's Albums page (`/albums`, `apps/portfolio/src/routes/albums.tsx`) shows each album with a strip of its
photos, newest first, counting the photos in its sub-albums too (as the album filter does). Albums come in the order
set with the arrows on the pipeline's [Albums](albums-and-tags.md#order) page, each followed by its sub-albums, whose
headings name their parent (`New York › Brooklyn`). Albums without an order come after the rest, by name, and albums
with no photos are left out. Under each name are its description, how many photos it has and, for an album a
[spotlight zone](publish.md#site-spotlight) shows, where (`Also shown on the homepage.`).

Each photo is as tall as the strip and as wide as its own shape, and the strip scrolls sideways when they don't fit
(`components/album-strip.tsx`). Clicking a photo opens it in the [photo viewer](photo-viewer.md), which steps through
every photo in an album. The old `/spotlight` address redirects here.

The album order and the zones come from `ALLALBUMS.json` (`lib/groups.ts`), and an album's photos from
`lib/spotlight-zones.ts`, which the [homepage](portfolio-homepage.md) uses too.
