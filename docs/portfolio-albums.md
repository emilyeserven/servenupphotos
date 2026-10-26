# Portfolio Albums

The portfolio's Albums page (`/albums`, `apps/portfolio/src/routes/albums.index.tsx`) shows each album with a strip of its
first 5 photos in the album's order, counting the photos in its sub-albums too (as the album filter does). An album's order is
the one set by dragging its photos on the pipeline's album page ([Photo order](albums-and-tags.md#photo-order),
its file's `photoOrder`), with the photos it doesn't list after. Without one, or after those, it lists the photos that
kept a place from the old photo-by-photo spotlight (`websiteSpotlight`, 1 first) before the rest, which come newest
first. Albums come in the order
set with the arrows on the pipeline's [Albums](albums-and-tags.md#order) page, each followed by its sub-albums, whose
headings name their parent (`New York › Brooklyn`). Albums without an order come after the rest, by name, and albums
with no photos are left out. Under each name are its description, how many photos it has and, for an album a
[spotlight zone](publish.md#site-spotlight) shows, where (`Also shown on the homepage.`).

Each photo is as tall as the strip and as wide as its own shape, and the strip scrolls sideways when they don't fit
(`components/album-strip.tsx`). An album with more than 5 photos ends its strip with **See all N photos**, linking to
its page. Clicking a photo opens it in the [photo viewer](photo-viewer.md), which steps through every photo in a strip.
The old `/spotlight` address redirects here.

## An album's page

Each album's name links to its own page, `/albums/<id>` (`routes/albums.$id.tsx`), with its description and every
photo one under another, each as large as it fits: the full width, or the full height of the screen when that's
smaller (`components/fitted-photo.tsx`). Clicking a photo opens the photo viewer, which steps through the whole album.

The album order and the zones come from `ALLALBUMS.json` (`lib/groups.ts`), and an album's photos from
`lib/spotlight-zones.ts`, which the [homepage](portfolio-homepage.md) uses too.
