# All Photos

`/all-photos` (under **Images** in the sidebar) shows every photo in one list, in the portfolio's order, as Square
Thumbnail tiles with their title (or file name), when they were taken, and **Edit**. It reads the base branch's
photos (`GET /api/photos/published`, as the [Gallery](gallery.md) does) with the photo data pull request's files
and the [changes waiting for Commit](pending-changes.md) over them (`GET /api/photos/in-flight`), and makes the
[local edits](combined-data-store.md#local-edits) too, so a photo shows as the next Commit will save it. A photo the
pull request removes, one whose JSON couldn't be read, and one that [lost in a compare group](compare-groups.md) are
left out. Nothing new is needed from the backend.

> **Frontend analogy:** it's a client-side join of two queries' caches: the base branch's list, with the pull
> request's copies replacing the rows they share, like spreading a patch object over the original.

## Drafts and Undecided photos

Only published photos show at first. **Drafts → Shown** (`?drafts=true`) puts the [drafts](drafts.md) without a
title among them, and **Undecided → Shown** (`?undecided=true`) the photos set aside as
[Undecided](photos-in-flight.md#undecided), each where the sort places it, so you can see where it would go on the
portfolio. Drafts have a purple **Draft** mark and Undecided photos an amber **Undecided** one, with a dashed border
and a dimmed image. The counts above the toggles say how many of each there are. With **Keep untitled photos as
drafts** turned off in Settings, every photo counts as published, as Commit then treats them.

## Sort

**Sort** orders the photos by **Date taken** (the default), **Date added** (the [`addedDate`](data-model.md#date-added)),
**Time of day** (by the clock where they were taken), **Color** (around the color wheel, then the shades) or
**Vividness** (average), and **Order** runs it either way: oldest or newest first, earliest or latest, red to white
or white to red, least or most vivid first. They're kept in the URL as `?sort=` (left out for date taken) and
`?order=asc|desc` (left out for each sort's usual way: newest first, earliest first, red first, most vivid first);
changing the sort resets the order. Photos a sort can't place (no date, no date added, or no colors saved yet) come
after the rest, newest first. Color and Vividness use the portfolio's own `sortPhotos`
(`apps/portfolio/src/lib/color-sort.ts`), so they match the Color page.

## Jumping to a photo

A box floating at the bottom right, **Drafts and Undecided**, lists every draft and Undecided photo in the page's
sort, whether they're shown or not. Picking one turns its kind on, scrolls to it and rings it. The box collapses to
its count with its header, and starts collapsed below the `lg` breakpoint so it doesn't cover the photos on a phone.

`?photo=<path>` names the photo to scroll to and ring, and that photo is shown even when its kind is hidden. The
**See in All Photos** button (a crosshair icon) beside a draft or Undecided photo elsewhere opens it this way, with
its kind shown:

- on Photos in Flight, next to a photo's **Draft, not on the portfolio** mark, and on each tile in the **Drafts**,
  **Undecided** and **Can't be edited** panels,
- on the Gallery, next to a photo's draft mark.

The code is in `apps/client-pipeline/src/routes/all-photos.tsx` and `components/all-photos/`.
