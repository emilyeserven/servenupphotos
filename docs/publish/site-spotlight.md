# Site Spotlight

`/site-spotlight` picks the album each **spotlight zone** of the portfolio shows. The zones are listed in `apps/client-pipeline/src/lib/site-spotlight.ts`: **Homepage** (`"homepage"`), the photos fading in and out behind the [portfolio homepage](../portfolio-homepage.md), then **Timeline Header** (`"timeline-header"`) and **Grid Header** (`"grid-header"`), **Stats Header** (`"stats-header"`) and **Settings Header** (`"settings-header"`), photos fading in and out across the top of the [Timeline](../portfolio-timeline.md), the [Grid](../portfolio-grid.md), the [Stats page](../portfolio-stats.md) and the [Settings page](../portfolio-settings.md) (see [Header spotlights](#header-spotlights)). A zone shows every photo in its album and the album's sub-albums, in the album's order (see [Portfolio Albums](../portfolio-albums.md)). With no album picked, the homepage shows the 5 newest photos instead.

Each zone is a card with an **Album** picker and the photos the zone will show, read from `ALLPHOTOS.json` in the [combined data store](../combined-data-store.md). Picking an album (`PUT /api/organize/spotlight/<zone>` with `{ "album": "<id>" | null }`) saves the zone in that album file's `spotlightZones`, a list of zone IDs, and takes it out of every other album's, so a zone has one album at a time. The album that gets the zone also gets the day in its `spotlightUpdated`, such as `{ "homepage": "2026-11-07" }`, which the [Dashboard](../dashboard.md) shows. Like other album changes, it's a [change waiting for Commit](../pending-changes.md).

Once a zone has an album, **Photos first** picks which photos it puts first: **Match the screen** (the default) puts portrait photos first on a phone held upright and landscape photos first on every other screen, each part keeping the album's order; **Album order** keeps the album's order everywhere. It's saved with the same request (`{ "album": "<id>", "orientation": "screen" | "none" }`) in the album file's `spotlightOrientation`, an object of zone ID to choice, such as `{ "grid-header": "none" }`. A zone the object leaves out matches the screen. Picking another album for a zone without an orientation moves the zone's choice along to the new album's file. Photos are added to an album on the Gallery or a photo's page (see [Albums and Tags](../albums-and-tags.md)).

## Focus spots

Under **Photos first**, **Focus spots** lists the photos the zone shows, in its order, as small squares (`components/zone-focus.tsx`); one with its own focus point for the zone has a dot. Clicking one picks it, and under them its **Focus point** for that zone: click the part of the photo to keep in view where the zone crops it, such as a landscape photo on a phone behind the homepage, or any photo in a header's wide strip (`components/spotlight-focus.tsx`). **Use the middle** clears it. Each zone keeps its own, so the same photo can be cropped one way behind the homepage and another across the Grid. Focus points are set only here; the Photo page no longer has them.

Beside the photo, the preview updates as the point moves. For the Homepage, it's the homepage on a phone held upright and on a computer, each drawn at its real size (390 × 844 and 1440 × 900) and scaled down to fit: the photo cropped around its focus point with no tint, the frosted site name and view tiles, and the photo's title at the bottom left, after a map button when it has a GPS position or a place (`components/spotlight-preview.tsx`). For a header, it's the strip at 390 × 253 and 1440 × 270, 30% of those screens' heights, fading into the page at the bottom (`components/header-preview.tsx`). Photos without resized versions, or whose file wasn't read, are left out, as the portfolio leaves them out.

Under the photo, a three by three grid picks **where on the screen the focus point goes** in the zone: the middle (the default), or a side or corner, such as the bottom middle to have it low on the screen (`components/spotlight-placement.tsx`). The spots are 20%, 50% and 80% across and down. The crop moves the photo to get the point there, as near as the photo's edges allow, so it never leaves a gap; on a side the photo already fills, nothing moves.

Both are saved in the photo file's `spotlightZoneFocus`, an object of zone ID to `{ "focus", "placement" }`, each `{ "x": 30, "y": 70 }` in percent across from the left and down from the top, or `null` for the middle:

```json
"spotlightZoneFocus": { "grid-header": { "focus": { "x": 75, "y": 30 }, "placement": null } }
```

A zone the object leaves out, or a photo without it, uses the photo's older `spotlightFocus` and `spotlightPlacement` (the single focus point the Photo page used to set, for every zone), and the first change in a zone starts from them. It's a [local edit](../combined-data-store.md#local-edits) until **Commit**.

> **Frontend analogy:** the preview is a fixed-size `<div>` with `transform: scale()`, like zooming out on a design mockup: the CSS inside runs at full size, so the crop and the blur look as they do live.

## Header spotlights

On the portfolio, the Timeline, Grid, Stats and Settings pages each start with their zone's photos when an album is picked for it (`components/header-spotlight.tsx`, placed by `routes/__root.tsx` for the `/timeline`, `/grid`, `/stats` and `/settings` paths). They span the page's width, 30% of the screen's height (`30svh`), fading in and out every 7 seconds like the homepage, each cropped around its focus point and placement, with a fade into the page's background over the bottom two thirds. The page's title, filters and the rest come after them, and the site menu stays fixed at the top right. With no album picked, the page starts with its title as before.

Like the homepage, each visit starts on the photo after the one this browser showed last in that zone, going back to the first after the last one. Each zone keeps its own in `localStorage` as `servenup-last-<zone>-photo`, such as `servenup-last-grid-header-photo`, saved each time a new photo comes up (`lib/last-spotlight-photo.ts`, which the homepage's `servenup-last-homepage-photo` uses too).

On the Timeline and Grid, a **Jump to Cover Image** button at the strip's top right, just left of the site menu button (`components/jump-to-cover.tsx`), scrolls to the photo showing in the strip at that moment, its Grid tile or table row or its Timeline row, to the middle of the screen, and rings it for a moment. Each tile and row carries its photo's ID as `data-photo-id` for this. When the page doesn't show the photo, because a filter leaves it out or its Timeline month is closed, the button opens it in the [photo viewer](../photo-viewer.md) instead.

> **Frontend analogy:** it's an in-page anchor link, except the target is found by `data-photo-id` when clicked, since the photo showing changes every few seconds.

> **Frontend analogy:** it's like a layout route rendering a hero banner above `<Outlet />`, chosen by the URL, so the pages themselves don't change.

> **Frontend analogy:** it's like a radio group spread over several files: choosing one album unchecks the others, and the backend writes every file whose checkbox changed.

> **Frontend analogy:** `object-position: 30% 70%` lines up the image's 30% point with the box's 30% point. To put the image's point `f` at the box's point `a` instead, the position is `(a·box − f·drawn) / (box − drawn)`, where `drawn` is the image's size after `object-fit: cover` scales it, clamped to 0–100% so no gap shows (`objectPosition` in `lib/spotlight-focus.ts`, the same in the pipeline and the portfolio).

> **Frontend analogy:** the Go side writes an object or `null` into the JSON file the same way it writes a list: the whole value is replaced, like `setState(next)` rather than merging.
