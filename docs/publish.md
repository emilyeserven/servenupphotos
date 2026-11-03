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

Each change is kept in the app as a [local edit](combined-data-store.md#local-edits) right away: the sync button at the
top right counts the photo, and `ALLPHOTOS.json` in the app shows the new date. Nothing goes to GitHub until
**Commit**, which sets `socialMediaPublishDate` in each changed photo file in the same commit as `ALLPHOTOS.json`. Only
that field changes in each file. (`PUT /api/publish/instagram`, which saves dates on their own, is still there but the
page doesn't use it.)

> **Frontend analogy:** it's a draft kept in a client-side store (persisted to `localStorage`) instead of component
> state, so it survives a reload and other pages can see it; Commit is the one "Save all" request.

The calendar also shows the Instagram posts saved on photos under **Social media posts** (below): a day with one gets
a check in its corner when every post that day is up, or a clock while one is scheduled (with a count when there's
more than one), and an empty day shows that photo faded behind its **+**. Under the calendar, **Instagram posts** lists
the posts on the days shown, each with its photo, **Posted** or **Scheduled**, whether the photo is **In flight** or as
the **Gallery** has it, a link to the post and a link to edit the photo. Gallery and in flight photos are both
included, and nothing more is fetched for them: the posts come from the photo files the calendar already read, with
the changes waiting for Commit and local edits the app keeps (`useChangedPhotoFiles` in the combined data store) made
over them, so a post saved on the Photo page shows here before **Commit**. `apps/client-pipeline/src/lib/social-post-days.ts`
does the merging (`postedPhotoFiles`, `postsByDay`), for any page that needs each day's posts.

> **Frontend analogy:** it's an optimistic UI: the list is the last server response with the store's unsent mutations
> replayed over it, rather than a refetch.

## Social media posts

The Photo page in edit mode (`/exif?edit=<path>`) has a **Social media posts** card, for keeping track of where the
photo is posted or scheduled to post. Each post has a platform, a day, a link, a caption and hashtags, saved as the photo file's `socialPosts` list, `[]` by default (new saves write it, and Update
Data → Missing fields adds it to older files):

```json
"socialPosts": [
  {
    "platform": "instagram",
    "date": "2026-10-20",
    "url": "https://www.instagram.com/p/…",
    "caption": "Late light over the river.",
    "hashtags": ["streetphotography", "nyc"]
  }
]
```

`date` is `YYYY-MM-DD`, or `null` when it's left empty. Whether a post is **Posted** or **Scheduled** isn't saved: it's
worked out from its day each time it's shown (`postStatus` in `social-posts.ts`), posted on or before today and
scheduled after it or without a day, so a post moves to posted by itself once its day comes. The card shows it next to
the post's heading, and the Instagram calendar's marks and **Instagram posts** list use the same. A `status` saved
by older versions is ignored and dropped the next time the posts are saved. Hashtags are typed separated by spaces or commas, with or
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
`apps/client-pipeline/src/lib/site-spotlight.ts`; the first is **Homepage** (`"homepage"`), the photos fading in and
out behind the [portfolio homepage](portfolio-homepage.md). A zone shows every photo in its album and the album's
sub-albums, in the album's order (see [Portfolio Albums](portfolio-albums.md)). With no album picked, the homepage shows the 5 newest photos instead.

Each zone is a card with an **Album** picker and the photos the zone will show, read from `ALLPHOTOS.json` in the
[combined data store](combined-data-store.md). Picking an album (`PUT /api/organize/spotlight/<zone>` with
`{ "album": "<id>" | null }`) saves the zone in that album file's `spotlightZones`, a list of zone IDs, and takes it out
of every other album's, so a zone has one album at a time. Like other album changes, it's a
[change waiting for Commit](pending-changes.md). Photos are added to an album on the Gallery or a photo's page (see
[Albums and Tags](albums-and-tags.md)).

Above the photos, **Preview** shows them one at a time as the homepage would, on a phone held upright and on a
computer, with buttons for the photo before and after. With no album picked, there's no preview. Each
screen is the homepage drawn at its real size (390 × 844 and 1440 × 900) and scaled down to fit: the photo cropped
around its focus point with no tint, the frosted site name and view tiles, and the photo's title at the
bottom left, after a map button when it has a GPS position or a place (`components/spotlight-preview.tsx`). It reads
`ALLPHOTOS.json` with local edits applied, so a focus point set but not committed already shows. Photos without
resized versions are left out, as the portfolio leaves them out. The homepage's real order on a phone, portrait photos
first, isn't previewed.

> **Frontend analogy:** the preview is a fixed-size `<div>` with `transform: scale()`, like zooming out on a design
> mockup: the CSS inside runs at full size, so the crop and the blur look as they do live.

> **Frontend analogy:** it's like a radio group spread over several files: choosing one album unchecks the others, and
> the backend writes every file whose checkbox changed.

The Photo page in edit mode (`/exif?edit=<path>`) has a **Spotlight** card in its left column, under Albums and Tags,
linking to Site Spotlight.

The card has the photo's **Focus point**: click the part of the photo to keep in view when it's
cropped to a screen of the other shape (a landscape photo on a phone, or a portrait one on a computer). Under it,
**Behind the homepage** shows the same phone and computer preview as Site Spotlight, updating as the point moves,
once an album is picked for a zone on Site Spotlight. **Use the middle** clears it. It's saved as `spotlightFocus`, `{ "x": 30, "y": 70 }`
in percent across from the left and down from the top, or `null` (the default, which new saves write and Update Data →
Missing fields adds) for the middle. It's a [local edit](combined-data-store.md#local-edits) until **Commit**, apart
from the page's **Save changes**.

Under the photo, a three by three grid picks **where on the screen the focus point goes**: the middle (the default), or
a side or corner, such as the bottom middle to have it low on the screen (`components/spotlight-placement.tsx`). The
spots are 20%, 50% and 80% across and down. The crop moves the photo to get the point there, as near as the photo's
edges allow, so it never leaves a gap; on a side the photo already fills, nothing moves. It's saved as
`spotlightPlacement`, the same shape as `spotlightFocus` in percent of the screen, or `null` for the middle, the same way
(a local edit until Commit, `null` by default and added by Missing fields). The preview shows it.

> **Frontend analogy:** `object-position: 30% 70%` lines up the image's 30% point with the box's 30% point. To put the
> image's point `f` at the box's point `a` instead, the position is `(a·box − f·drawn) / (box − drawn)`, where `drawn` is
> the image's size after `object-fit: cover` scales it, clamped to 0–100% so no gap shows
> (`objectPosition` in `lib/spotlight-focus.ts`, the same in the pipeline and the portfolio).

> **Frontend analogy:** the Go side writes an object or `null` into the JSON file the same way it writes a list: the
> whole value is replaced, like `setState(next)` rather than merging.
