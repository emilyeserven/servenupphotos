# Dashboard

The pipeline's home page (`/`, opened from the logo at the top of the sidebar) is a **Dashboard** of what to work on
next. Each card's title links to the page it comes from. While the upload queue has anything in it, the queue sits above
the cards (see [Bulk Upload](bulk-upload.md)). What used to be the home page, the services and connections check, is
now **Settings › Status** (see [Settings](settings.md#status)).

## The cards

- **Needs attention:** across the full width above the other cards, one row per problem, each with how many photos it
  affects and a link to the page that fixes it. Rows only show while something has the problem; with none, it says
  nothing needs attention. It counts every photo file as the next Commit will have it (changes waiting for Commit and
  local edits made, removed files left out), from the same read as the Instagram card, so it asks GitHub nothing new:
  - **Instagram:** fewer than 7 **days left** in the queue (counted as **Next on Instagram** counts them), with how
    many photos it would take to fill a week. Links to the [Instagram calendar](publish.md).
  - **Photos without a title** that aren't Undecided or unselected. Links to the first one, by path, on the Photo page.
  - **Photos without tags**, **without a genre**, **that aren't in an album** and **without a place**, counted as
    [Bulk tagging](update-data.md#bulk-tagging), Genre Suggestions, [Album Suggestions](update-data.md#album-suggestions)
    and [Bulk Places](update-data.md#bulk-places) pick them, and linking to those pages.
  - **Photos without color data:** no `colors`, or `colors` saved before `peakChroma`, as **Update Data › Colors**
    reads them, linking there.
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
  in a row from today that have a photo, through the last of them. Photos scheduled after the first empty day are
  counted on their own ("2 more are scheduled after a gap").
- **Site Spotlight:** each [spotlight zone](publish.md#site-spotlight), the album it shows and the day that album was
  picked for it, from the album file's `spotlightUpdated`. An album picked before these days were kept says so, and
  gets a date the next time it's picked.

The cards are in `components/dashboard/`, the queue's counting in `lib/social-queue.ts` (shared through
`hooks/use-social-queue.ts`), and the Needs attention checks in `lib/needs-attention.ts`.
