# Portfolio Likes

Visitors can like photos on the portfolio and see them on **My Likes** (`/likes`, `routes/likes.tsx`). Likes belong to
the browser: nothing is sent to GitHub or the pipeline, and there's no account. My Likes is in the site menu, after
Lucky, but has no tile on the [homepage](portfolio-homepage.md).

## Liking a photo

In the [photo viewer](photo-viewer.md), **double tapping** (or double clicking) the photo likes it, and a heart pops
over it for a moment. The **heart** button, to the left of the eye button, shows whether the photo is liked (filled
red) and likes or unlikes it. A double tap only ever likes; unliking is the heart button's job.

A single tap on the photo does nothing while the details are shown, so it can't be mistaken for the start of a double
tap. While the details are hidden, a single tap brings them back, but only once 300ms have passed without a second
tap, so a double tap there likes the photo and leaves the details hidden (`lib/use-taps.ts`).

> **Frontend analogy:** `useTaps` is a debounce on `click`: the first click starts a 300ms timer for the single-tap
> action, and a second click inside that window cancels it and runs the double-tap action instead. `touch-action:
> manipulation` on the photo stops mobile browsers from zooming on a double tap, while pinch-zoom still works.

## What's saved

Two entries in the browser's `localStorage`, read once on load and kept in memory (`lib/stored-value.ts`,
`lib/likes.ts`):

| Key                      | Holds                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| `servenup-liked-photos`  | The liked photos' ids (the `id` in their JSON), most recently liked first |
| `servenup-like-comments` | The visitor's own comment on each liked photo, by id                      |

Every page reading them re-renders on a change, including a change made in another tab. A comment stays when its photo
is unliked, so liking it again brings it back. A liked photo that's no longer in `ALLPHOTOS.json` is left off My Likes.
If storage is blocked (some private windows), likes last until the page is reloaded.

> **Frontend analogy:** it's a tiny Zustand store with the `persist` middleware, written by hand with
> `useSyncExternalStore` so the portfolio doesn't need another dependency.

## My Likes

The page lists the liked photos, most recently liked first. Each row has the photo's thumbnail (which opens the photo
viewer, moving through the liked photos), its title and date, a box for the visitor's own comment, saved as they type,
and a red heart that unlikes it. Unliking from the viewer leaves the photo in place until the viewer closes, so the
‹ › buttons don't jump.

Above the rows is **Send to the photographer**: text to copy with a **Copy** button, and a toggle for the message
service it's going through, kept in the URL:

| Service               | URL             | The text                                                                                   |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| **Discord** (default) |                 | A Markdown list of titles linking to each photo, then the visitor's comment, if it has one |
| **Messenger / Text**  | `?service=text` | Only the ids, comma separated: `281, 284, 286`                                             |

A Discord line looks like `- [Castle Door](https://servenupphotos.net/photos/284/): love the light`. Discord shows the
title as a link; Messenger and text messages don't render Markdown, so they get just the ids. The links go to each
photo's own page (see [Sharing a photo](photo-viewer.md#sharing-a-photo)), on whichever host the page is served from.

The photographer pastes either one into the pipeline's likes import, which reads the ids from the `/photos/<id>/`
links or the comma separated list, so both formats need to stay as they are.

## Analytics

On the published site, liking and unliking send Umami events named `like` and `unlike`, with the photo's id as
`photo` (see [Portfolio analytics](portfolio-analytics.md)). Comments are never sent.
