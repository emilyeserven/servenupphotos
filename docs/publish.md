# Publish

The **Publish** section of the sidebar is for choosing where photos are shown. Each photo JSON file has three fields
for it, which new saves write with their defaults: `isSocialMediaEligible` (`false`), whether the photo may be posted
to social media; `websiteSpotlight` (`null`), the photo's place among the photos spotlighted on the site, or `null`
when it isn't spotlighted; and `socialMediaPublishDate` (`null`), the day the photo is scheduled to post to social
media, as `YYYY-MM-DD`. Older files may be missing them, which means the same as the defaults.

`/instagram` is a calendar of the photos scheduled to post, one a day. It shows three weeks, starting with this one
(Sunday first), and pages a week at a time. Clicking an empty day picks a photo for it from the photo files, read
where Update Data reads them, so photos in flight on the **Add photo data** pull request are included and marked as
such (eligible photos first), and ones without a title are marked **Draft** (see [Drafts](drafts.md)): they can be
scheduled, but aren't on the portfolio; clicking a scheduled photo changes or removes it. Dragging a photo to another
day moves it there, and dropping it on another photo swaps the two. The page reads the photo files with
`GET /api/publish/instagram`, each with its whole JSON as `data`.

Photos set aside as [Undecided](photos-in-flight.md#undecided) (`undecided: true`) aren't on the page at all: not in
the picker or its suggestions, not on the calendar, and not under **Instagram posts**. A change not committed yet
counts, so marking a photo Undecided on Photos in Flight takes it off right away; the note at the top says how many
are hidden (`withoutUndecided` in `lib/social-schedule.ts`). Untitled drafts are still offered.

Each change is kept in the app as a [local edit](combined-data-store.md#local-edits) right away: the sync button at the
top right counts the photo, and `ALLPHOTOS.json` in the app shows the new date. Nothing goes to GitHub until
**Commit**, which sets `socialMediaPublishDate` in each changed photo file in the same commit as `ALLPHOTOS.json`. Only
that field changes in each file. (`PUT /api/publish/instagram`, which saves dates on their own, is still there but the
page doesn't use it.)

> **Frontend analogy:** it's a draft kept in a client-side store (persisted to `localStorage`) instead of component
> state, so it survives a reload and other pages can see it; Commit is the one "Save all" request.

The calendar also shows the Instagram posts saved on photos under **Social media posts** (below): a day with one gets
a check in its corner when every post that day is scheduled on Instagram, or a clock while one is still planned (with a
count when there's more than one), and an empty day shows that photo faded behind its **+**. Under the calendar, **Instagram posts**
lists every post in three tabs, each with its count: **Posted** (scheduled on Instagram on a day up to today, newest
first), **Scheduled** (scheduled on Instagram for a day after today, soonest first, and open at first) and
**Unposted** (still planned, whatever the day, soonest first; `postsByTab` in `lib/social-post-tabs.ts`). Each post
shows its photo, the tab's name, whether the photo is **In flight** or as the **Gallery** has it, a link to the post
and a link to edit the photo. Gallery and in flight photos are both
included, and nothing more is fetched for them: the posts come from the photo files the calendar already read, with
the changes waiting for Commit and local edits the app keeps (`useChangedPhotoFiles` in the combined data store) made
over them, so a post saved on the Photo page shows here before **Commit**. `apps/client-pipeline/src/lib/social-post-days.ts`
does the merging (`postedPhotoFiles`, `postsByDay`), for any page that needs each day's posts.

> **Frontend analogy:** it's an optimistic UI: the list is the last server response with the store's unsent mutations
> replayed over it, rather than a refetch.

### Social Feed preview

The page has two tabs under the Focus: **Calendar** (the calendar and **Instagram posts**) and **Social Feed**. The
open tab is kept in the address as `?tab=feed`, so a reload or a link opens the same one. On the **Social Feed** tab,
**Social Feed preview** shows the Instagram profile grid as it will look at the end of a
chosen day: three columns of 3:4 tiles, newest first, like the profile page. The day starts as today; pick another with the date picker to see the feed on any day before or after, step a day at
a time with the arrow buttons on either side of it or the left and right arrow keys (unless a field, menu or the tabs
have focus), and **Today** goes back. The tiles are every photo on
the calendar (with dates moved and not committed yet) and every Instagram post with a day under **Social media
posts**, up to that day; a photo that is on the calendar and has a post on the same day is one tile. Photos that post
on the chosen day are ringed, and ones still to come after today get a corner mark: a calendar for a calendar day, a
clock for a planned post, and a check for one scheduled on Instagram. Each tile links to its Photo page, and the grid
shows four rows at a time with **Show more** for the rest. A tile whose photo is on the calendar can be dragged onto
any other tile, in any row, to move it to that tile's day, swapping with the calendar photo already there, just as
dragging on the calendar does (they share the same drag, so a tile can also be dropped on a calendar day). Tiles that
come only from **Social media posts** can't be dragged, since their day is the post's, set on the Photo page. `apps/client-pipeline/src/lib/social-feed.ts` builds the
feed (`feedEntries`, `feedAsOf`).

### Grid Anchors

A photo on the calendar can be made a **Grid Anchor** from its day's picker (**Make Grid Anchor**, next to **Remove
from this day**), to plan thematic rows of the feed. The anchor and the 2 calendar photos just before it make a
group of 3, one row of the 3-column feed (`ANCHOR_ROW` in `apps/client-pipeline/src/lib/grid-anchors.ts`). While a
photo is an anchor, the picker also takes an optional name for its group. Each group is outlined in its own color on
the calendar and in the **Social Feed preview**, with a badge on the anchor itself showing the group's name when it
has one. The outlines are only a reference: the feed doesn't flag a group that isn't lined up with a row, since
groups drift in and out of line between anchors.

It's saved on the anchor's JSON as `socialGridAnchor: true`, with the name as `socialGridGroupName`, kept as local
edits until **Commit** like a moved date. Photos that aren't anchors, and groups without a name, leave the fields
out; removing an anchor drops its name too.

### Suggested photos

When a day is picked, the picker opens with two sections, each folded or opened by its heading. The first, **Before
and after** (open at first), holds the photos taken just around the last one on the calendar before that day: the 3 taken before it and the 5 taken after, in the order they were taken (custom date
or EXIF, then file name), whether or not they're scheduled yet. Each says where it falls, such as "2 before" or "1
after", and one already on another day shows that day. Photos without a date are skipped, and so are ones the Focus
leaves out. `apps/client-pipeline/src/lib/social-neighbors.ts` picks them.

The second, **Suggested**, is folded at first to its first row of photos (3 on a phone, 4 wider) and holds up to 8
unused photos, not already under **Before and after**, most like the 3 photos on
Instagram on the days just before it (on the calendar, or with an Instagram post under **Social media posts**). Below
it, **All photos** lists the rest as before. "Unused" means not on the calendar and with no Instagram post, planned
or scheduled. Each pair of photos is scored from 0 to 1 and a photo's score is its average against the 3:

- **Place (40%):** by distance when both have a GPS position (custom or EXIF), halving every 25 km; else 0.8 for a
  shared place or city, 0.3 for the same country.
- **Date (40%):** by days between when they were taken (custom date or EXIF), halving every 14 days.
- **Tags (20%):** the share of their tags they have in common.

Photos under 0.2 aren't suggested. Each suggestion says why, against the closest of the 3, such as "2 km away · Same
day · 3 tags in common". Suggestions read the photo files with changes waiting for Commit and local edits made over
them, and are hidden while searching. The scoring is in `apps/client-pipeline/src/lib/social-suggestions.ts`; its
constants at the top set the weights and distances.

> **Frontend analogy:** it's a "related items" sort done in the browser: every candidate gets a weighted score
> against the last few items, like ranking search results by several fields at once.

### Focus

**Focus**, folded above the calendar, sets the filters the picker starts with each time it opens: dates taken from and
to, a place (text in the photo's city, state, country or place name), tags and genres (any of several, with commas),
and only photos eligible for social media. Both **Suggested** and **All photos** follow it, and a photo without a
date is left out while dates are set. In the picker, a **Focus** box shows what it filters and can be unticked to see
every photo for that one pick. The Focus is kept in this browser (`localStorage`, `stores/social-focus.ts`), not on
GitHub; the filters are in `lib/social-focus.ts`.

> **Frontend analogy:** it's saved default filters, like a persisted Zustand slice for a table's filter bar.

### Planned Posts

`/instagram-planned`, under **Instagram** in the sidebar, goes through the photos still to put on Instagram one at a
time, made to sit in a narrow window next to Instagram. A photo is planned when it has an Instagram post with status
**Planned**, or is on the Instagram calendar without an Instagram post that's **Scheduled**. They come in the order
they go up: by the planned post's day, or else the calendar day, with photos without a day last; a day before today is
marked **Overdue**. Photos set aside as Undecided are left out, as on the calendar. The list is worked out in the
browser from the photo files the calendar reads, with changes waiting for Commit and local edits made over them
(`plannedPhotos` in `apps/client-pipeline/src/lib/instagram-planned.ts`).

Each photo shows its Medium version, its name (a link to edit it), its day, and:

- **Download original JPEG**, which saves the original from R2, named after the photo's `file`. A browser won't
  download straight from R2's address on another origin, so the link goes through the pipeline:
  `GET /api/photos/original?key=<images.key>&name=<file>` reads the original from R2 and sends it as an attachment.
- **Caption**, the default Instagram [caption template](caption-templates.md) (the first one for Instagram, or else the
  first for any platform, as the Photo page's Generate starts with) filled in from the photo and its planned post's
  hashtags, with **Copy caption**. A caption already written on the planned post is shown instead.
- **Mark as Scheduled and go to the next**, which sets the planned Instagram post's status to scheduled (keeping its
  caption, or else taking the one shown, and the calendar day when it has none), or adds a scheduled Instagram post
  with the caption on the calendar day when the photo had none. The photo leaves the list, so the next one shows in its
  place, and **Undo** above it puts its posts back. Like the calendar, it's a [local edit](combined-data-store.md#local-edits)
  of the photo's `socialPosts`, so nothing goes to GitHub until **Commit**.

**Previous** and **Next** move through the list without changing anything.

> **Frontend analogy:** it's a wizard over a derived list: the steps are a `useMemo` filter of the store, and finishing
> a step edits the store so the item filters itself out, the way a todo app's "done" button shrinks an "active" view.

## Social media posts

The Photo page in edit mode (`/exif?edit=<path>`) has a **Social media posts** card, for keeping track of where the
photo is posted or scheduled to post. Each post has a platform, a day, a link, a caption and hashtags, saved as the photo file's `socialPosts` list, `[]` by default (new saves write it, and Update
Data → Missing fields adds it to older files):

```json
"socialPosts": [
  {
    "platform": "instagram",
    "status": "scheduled",
    "date": "2026-10-20",
    "url": "https://www.instagram.com/p/…",
    "caption": "Late light over the river.",
    "hashtags": ["streetphotography", "nyc"]
  }
]
```

`date` is `YYYY-MM-DD`, or `null` when it's left empty. `status` is `"planned"` while the post still has to be put on
the site, and `"scheduled"` once it's there, posted or scheduled on the site to post; the card's **Status** field sets
it, and a new post starts **Planned**. The Instagram calendar's marks (a check when every post that day is
scheduled, a clock while one is planned) and its **Instagram posts** list show the same. A post saved before posts
kept their status (or with an older `"posted"`) counts as scheduled when it has a link or its day has come, and as
planned otherwise, until it's saved again (`savedStatus` in `social-posts.ts`). Hashtags are typed separated by spaces or commas, with or
without the `#`, and saved without it. The platforms offered are listed in
`apps/client-pipeline/src/lib/social-posts.ts` (Instagram, Threads, Bluesky, Facebook and Other); add one there to offer
it. A post with a platform that isn't listed, such as one typed into the JSON, keeps it.

A post's day is picked on a calendar (shadcn's `Calendar` in a `Popover`, in
`apps/client-pipeline/src/components/social-post-date-picker.tsx`), with **Clear** to leave it empty. Days other photos
already post on, on the same platform, are grayed out: the days of their `socialPosts` on that platform, and for
Instagram their Instagram calendar day (`socialMediaPublishDate`) too. The photos are the ones the Instagram calendar
reads (`GET /api/publish/instagram`, gallery and in flight alike), with the changes waiting for Commit and local edits
made over them (`postedPhotoFiles` and `useChangedPhotoFiles`, shared with the calendar's posts); the photo being
edited is left out. A grayed day can still be picked, since two posts on one day is rare but fine; the field then says
which photos already post that day.

> **Frontend analogy:** it's a `disabledDays`-style lookup built from data the app already has, except the days are
> only styled with a `modifiers` class instead of `disabled`, so the click still goes through.

Above each post's caption, **Generate** writes the caption from a [caption template](caption-templates.md) and the
photo's data as it's being edited, asking first when the caption already has text. The template picked starts as the
first one for the post's platform.

The card is saved with the rest of the page's changes by **Save changes**, as a change waiting for Commit, so nothing
goes to GitHub until **Commit**. Saving writes the whole list over the file's. When the Instagram calendar has the photo
scheduled, the card says for which day and links to it; that day is still set on the calendar
(`socialMediaPublishDate`), separately from the posts.

## Site Spotlight

`/site-spotlight` picks the album each **spotlight zone** of the portfolio shows. The zones are listed in
`apps/client-pipeline/src/lib/site-spotlight.ts`: **Homepage** (`"homepage"`), the photos fading in and
out behind the [portfolio homepage](portfolio-homepage.md), then **Timeline Header** (`"timeline-header"`) and **Grid
Header** (`"grid-header"`) and **Stats Header** (`"stats-header"`), photos fading in and out across the top of the
[Timeline](portfolio-timeline.md), the [Grid](portfolio-grid.md) and the [Stats page](portfolio-stats.md) (see [Header spotlights](#header-spotlights)). A zone shows every photo in its album and the album's
sub-albums, in the album's order (see [Portfolio Albums](portfolio-albums.md)). With no album picked, the homepage shows the 5 newest photos instead.

Each zone is a card with an **Album** picker and the photos the zone will show, read from `ALLPHOTOS.json` in the
[combined data store](combined-data-store.md). Picking an album (`PUT /api/organize/spotlight/<zone>` with
`{ "album": "<id>" | null }`) saves the zone in that album file's `spotlightZones`, a list of zone IDs, and takes it out
of every other album's, so a zone has one album at a time. The album that gets the zone also gets the day in its `spotlightUpdated`, such as
`{ "homepage": "2026-11-07" }`, which the [Dashboard](dashboard.md) shows. Like other album changes, it's a
[change waiting for Commit](pending-changes.md).

Once a zone has an album, **Photos first** picks which photos it puts first: **Match the screen** (the default) puts
portrait photos first on a phone held upright and landscape photos first on every other screen, each part keeping the
album's order; **Album order** keeps the album's order everywhere. It's saved with the same request
(`{ "album": "<id>", "orientation": "screen" | "none" }`) in the album file's `spotlightOrientation`, an object of zone
ID to choice, such as `{ "grid-header": "none" }`. A zone the object leaves out matches the screen. Picking another
album for a zone without an orientation moves the zone's choice along to the new album's file. Photos are added to an album on the Gallery or a photo's page (see
[Albums and Tags](albums-and-tags.md)).

### Focus spots

Under **Photos first**, **Focus spots** lists the photos the zone shows, in its order, as small squares
(`components/zone-focus.tsx`); one with its own focus point for the zone has a dot. Clicking one picks it, and under
them its **Focus point** for that zone: click the part of the photo to keep in view where the zone crops it, such as a
landscape photo on a phone behind the homepage, or any photo in a header's wide strip (`components/spotlight-focus.tsx`).
**Use the middle** clears it. Each zone keeps its own, so the same photo can be cropped one way behind the homepage and
another across the Grid. Focus points are set only here; the Photo page no longer has them.

Beside the photo, the preview updates as the point moves. For the Homepage, it's the homepage on a phone held upright
and on a computer, each drawn at its real size (390 × 844 and 1440 × 900) and scaled down to fit: the photo cropped
around its focus point with no tint, the frosted site name and view tiles, and the photo's title at the bottom left,
after a map button when it has a GPS position or a place (`components/spotlight-preview.tsx`). For a header, it's the
strip at 390 × 253 and 1440 × 270, 30% of those screens' heights, fading into the page at the bottom
(`components/header-preview.tsx`). Photos without resized versions, or whose file wasn't read, are left out, as the
portfolio leaves them out.

Under the photo, a three by three grid picks **where on the screen the focus point goes** in the zone: the middle (the
default), or a side or corner, such as the bottom middle to have it low on the screen
(`components/spotlight-placement.tsx`). The spots are 20%, 50% and 80% across and down. The crop moves the photo to get
the point there, as near as the photo's edges allow, so it never leaves a gap; on a side the photo already fills,
nothing moves.

Both are saved in the photo file's `spotlightZoneFocus`, an object of zone ID to `{ "focus", "placement" }`, each
`{ "x": 30, "y": 70 }` in percent across from the left and down from the top, or `null` for the middle:

```json
"spotlightZoneFocus": { "grid-header": { "focus": { "x": 75, "y": 30 }, "placement": null } }
```

A zone the object leaves out, or a photo without it, uses the photo's older `spotlightFocus` and `spotlightPlacement`
(the single focus point the Photo page used to set, for every zone), and the first change in a zone starts from them.
It's a [local edit](combined-data-store.md#local-edits) until **Commit**.

> **Frontend analogy:** the preview is a fixed-size `<div>` with `transform: scale()`, like zooming out on a design
> mockup: the CSS inside runs at full size, so the crop and the blur look as they do live.

### Header spotlights

On the portfolio, the Timeline, Grid and Stats pages each start with their zone's photos when an album is picked for it
(`components/header-spotlight.tsx`, placed by `routes/__root.tsx` for the `/timeline`, `/grid` and `/stats` paths). They span
the page's width, 30% of the screen's height (`30svh`), fading in and out every 7 seconds like the homepage, each
cropped around its focus point and placement, with a fade into the page's background over the bottom two thirds. The
page's title, filters and the rest come after them, and the site menu stays fixed at the top right. With no album
picked, the page starts with its title as before.

Like the homepage, each visit starts on the photo after the one this browser showed last in that zone, going back to
the first after the last one. Each zone keeps its own in `localStorage` as `servenup-last-<zone>-photo`, such as
`servenup-last-grid-header-photo`, saved each time a new photo comes up (`lib/last-spotlight-photo.ts`, which the
homepage's `servenup-last-homepage-photo` uses too).

On the Timeline and Grid, a **Jump to Cover Image** button at the strip's top right, just left of the site menu button (`components/jump-to-cover.tsx`), scrolls to the photo
showing in the strip at that moment, its Grid tile or table row or its Timeline row, to the middle of the screen, and
rings it for a moment. Each tile and row carries its photo's ID as `data-photo-id` for this. When the page doesn't
show the photo, because a filter leaves it out or its Timeline month is closed, the button opens it in the
[photo viewer](photo-viewer.md) instead.

> **Frontend analogy:** it's an in-page anchor link, except the target is found by `data-photo-id` when clicked,
> since the photo showing changes every few seconds.

> **Frontend analogy:** it's like a layout route rendering a hero banner above `<Outlet />`, chosen by the URL, so the
> pages themselves don't change.

> **Frontend analogy:** it's like a radio group spread over several files: choosing one album unchecks the others, and
> the backend writes every file whose checkbox changed.

> **Frontend analogy:** `object-position: 30% 70%` lines up the image's 30% point with the box's 30% point. To put the
> image's point `f` at the box's point `a` instead, the position is `(a·box − f·drawn) / (box − drawn)`, where `drawn` is
> the image's size after `object-fit: cover` scales it, clamped to 0–100% so no gap shows
> (`objectPosition` in `lib/spotlight-focus.ts`, the same in the pipeline and the portfolio).

> **Frontend analogy:** the Go side writes an object or `null` into the JSON file the same way it writes a list: the
> whole value is replaced, like `setState(next)` rather than merging.
