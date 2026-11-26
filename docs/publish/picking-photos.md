# Picking photos for the calendar

A day's picker, the photo drawer and the Focus are how photos are picked for the Instagram calendar.

## Suggested photos

When a day is picked, the picker opens with two sections, each folded or opened by its heading. The first, **Before and after** (open at first), holds the photos taken just around the last one on the calendar before that day: the 3 taken before it and the 5 taken after, in the order they were taken (custom date or EXIF, then file name), whether or not they're scheduled yet. Each says where it falls, such as "2 before" or "1 after", and one already on another day shows that day. Photos without a date are skipped, and so are ones the Focus leaves out. `apps/client-pipeline/src/lib/social-neighbors.ts` picks them.

The second, **Suggested**, is folded at first to its first row of photos (3 on a phone, 4 wider) and holds up to 8 unused photos, not already under **Before and after**, most like the 3 photos on Instagram on the days just before it (on the calendar, or with an Instagram post under **Social media posts**). Below it, **All photos** lists the rest as before. "Unused" means not on the calendar and with no Instagram post, planned or scheduled. Each pair of photos is scored from 0 to 1 and a photo's score is its average against the 3:

- **Place (40%):** by distance when both have a GPS position (custom or EXIF), halving every 25 km; else 0.8 for a shared place or city, 0.3 for the same country.
- **Date (40%):** by days between when they were taken (custom date or EXIF), halving every 14 days.
- **Tags (20%):** the share of their tags they have in common.

Photos under 0.2 aren't suggested. Each suggestion says why, against the closest of the 3, such as "2 km away · Same day · 3 tags in common". Suggestions read the photo files with changes waiting for Commit and local edits made over them, and are hidden while searching. The scoring is in `apps/client-pipeline/src/lib/social-suggestions.ts`; its constants at the top set the weights and distances.

> **Frontend analogy:** it's a "related items" sort done in the browser: every candidate gets a weighted score against the last few items, like ranking search results by several fields at once.

## Photo drawer

**Photos**, after the week buttons on the Calendar tab, opens a drawer beside the calendar (under it on a narrow screen) with the same photos and filters as a day's picker: the search, **Show already scheduled photos**, the **Focus** box, **Before and after**, **Suggested** and **All photos**, three photos wide. Its **Suggest for** names the day the two suggestion sections are worked out for: an open day shown on the calendar from today on (no photo and not Not Stored), the first one unless another is picked, moving on to the next open day once that one gets a photo.

A photo in the drawer can be dragged onto any day, with the same drag as moving a photo on the calendar (dropping it on a day with a photo swaps the two, and a Not Stored day takes nothing), or clicked to go on the **Suggest for** day. Dragging a calendar photo onto the drawer takes it off the calendar, like **Remove from this day**. Every move is a local edit kept for **Commit**, as on the calendar. The drawer stays open or closed after a reload (`localStorage`). The day's own buttons (**Make Grid Anchor**, **Mark as Not Stored**) stay in the day's picker. The drawer is `components/instagram-picker/photo-drawer.tsx`; it and the picker share `use-picker-photos.ts` and `picker-lists.tsx` in the same folder.

> **Frontend analogy:** it's the picker dialog's body rendered a second time in a non-modal side panel, sharing one hook for its state, with each tile a native HTML5 drag source for the calendar's existing drop targets.

## Focus

**Focus**, folded above the calendar, sets the filters the picker starts with each time it opens: dates taken from and to, a place (text in the photo's city, state, country or place name), tags and genres (any of several, with commas), and only photos eligible for social media. Both **Suggested** and **All photos** follow it, and a photo without a date is left out while dates are set. In the picker, a **Focus** box shows what it filters and can be unticked to see every photo for that one pick (in the photo drawer, until it's ticked again). The Focus is kept in this browser (`localStorage`, `stores/social-focus.ts`), not on GitHub; the filters are in `lib/social-focus.ts`.

> **Frontend analogy:** it's saved default filters, like a persisted Zustand slice for a table's filter bar.
