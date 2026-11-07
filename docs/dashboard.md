# Dashboard

The pipeline's home page (`/`, opened from the logo at the top of the sidebar) is a **Dashboard** of what to work on
next. Each card's title links to the page it comes from. While the upload queue has anything in it, the queue sits above
the cards (see [Bulk Upload](bulk-upload.md)). What used to be the home page, the services and connections check, is
now **Settings › Status** (see [Settings](settings.md#status)).

## The cards

- **Needs attention:** across the full width above the other cards, a table with one row per problem: its priority,
  what it is, how many photos it affects, and a link to the page that fixes it. Rows only show while something has the
  problem; with none, it says nothing needs attention. It counts every photo file as the next Commit will have it
  (changes waiting for Commit and local edits made, removed files left out), from the same read as the Instagram card,
  so it asks GitHub nothing new. The **Priority** column shows a red dot for high, yellow for medium and gray for low.
  The table starts sorted by priority, most urgent first, and pressing **Priority**, **Problem** or **Photos** sorts by
  that column instead (pressing it again flips the order). On a phone, the fix link moves under the problem.
  - **Photos without GPS** (high): no custom GPS position and none in the EXIF, leaving out photos marked
    [This photo won't have a GPS position](places-and-localizations.md#custom-gps-position). Links to the first one,
    by path, on the Photo page.
  - **Photos without color data** (high): no `colors`, or `colors` saved before `peakChroma`, as **Update Data ›
    Colors** reads them, linking there.
  - **Instagram** (medium): fewer than 7 **days left** in the queue (counted as **Next on Instagram** counts them), with
    how many photos it would take to fill a week. Links to the [Instagram calendar](publish.md).
  - **Photos without a place** (medium), counted as [Bulk Places](update-data.md#bulk-places) picks them, linking there.
    A photo without GPS is counted in the GPS row instead, since that's more serious, and one marked as going without
    GPS is left out.
  - **Photos without tags**, **without a genre** and **that aren't in an album** (low), counted as
    [Bulk tagging](update-data.md#bulk-tagging), Genre Suggestions and
    [Album Suggestions](update-data.md#album-suggestions) pick them, and linking to those pages.

  Untitled photos aren't listed: they're drafts, which the **Drafts** card covers.

- **Next up albums:** the [Lightroom Albums](lightroom-albums.md#next-up) page's Next up suggestions. It shows the
  **Overview** list by default; the menu at the top right picks one stage's list instead (Cull Round 1 to Re-editing,
  or No stage). It follows the Lightroom Albums page's **Online / Offline** choice, and, like that page, reads only
  the list kept in this browser. With no list yet, it links to Import.
- **Bulk Upload:** a button that opens the Bulk Upload modal, the same one as the sidebar's.
- **Drafts:** 3 photos that are [drafts](drafts.md) right now (untitled, or set aside as Undecided), from the Gallery and
  Photos in Flight with their local edits, with how many there are. **Random** (the default) picks 3 at random, and
  pressing it again picks 3 others; **Newest** and **Oldest** go by photo ID, which grows as each file is made, since
  drafts have no date added. Unselected photos from Compare aren't counted. A tile opens the photo on the Photo page.
- **Open Compare sets:** every [compare group](compare-groups.md), with its photo count and how many winners are picked,
  each opening the group. Finishing a group takes it off.
- **Next on Instagram:** the next 3 photos scheduled from today on, as the [Instagram calendar](publish.md) has them
  (with dates not committed yet, and without Undecided photos), and how many **days are left** in the queue: the days
  in a row from today that have a photo, through the last of them. A day counts when it has a photo on the calendar
  (`socialMediaPublishDate`) or when a photo has an Instagram post on it in its
  [Social media posts](publish.md#social-media-posts) (`socialPosts`), planned or scheduled, as the calendar marks
  those days too. A day with both shows the calendar's photo. Photos scheduled after the first empty day are
  counted on their own ("2 more are scheduled after a gap").
- **Site Spotlight:** each [spotlight zone](publish.md#site-spotlight), the album it shows and the day that album was
  picked for it, from the album file's `spotlightUpdated`. An album picked before these days were kept says so, and
  gets a date the next time it's picked.

The cards are in `components/dashboard/` (the Needs attention table, built with TanStack Table, in
`needs-attention-table.tsx`), the queue's counting in `lib/social-queue.ts` (shared through
`hooks/use-social-queue.ts`), and the Needs attention checks in `lib/needs-attention.ts`.
