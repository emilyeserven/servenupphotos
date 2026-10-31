# Compare groups

A **compare group** holds photos weighed head-to-head to decide which one gets posted, such as three frames of the
same lantern street. Any photo from the [Gallery](gallery.md) or [Photos in Flight](photos-in-flight.md) can go in one,
drafts and [Undecided](photos-in-flight.md#undecided) photos included. Groups are only in the pipeline: the portfolio
never reads or shows them.

## Putting a photo in a group

**Compare** (a scale icon) is on each Gallery tile, on each photo in flight beside **Undecided**, and on each draft
tile under **Drafts on `<branch>`**. It opens a dialog to choose a group, or to type a name and **Start a group named
“…”**. A photo is in at most one group, so choosing another moves it. Once a photo is in a group, its button shows the
group's name, and the dialog adds **Compare “…”**, to open the group, and **Take out of the group**.

## The Compare page

`/compare` (**Compare** in the sidebar, under **Pipeline**) lists every group as a card with its photo count, its
winner when one is picked, and its first four Square Thumbnails (from the [offline copy](offline-mode.md)), the
winner's outlined. A card opens the group at `/compare?group=<name>`.

There, the group's photos sit side by side, two or three across, each at its Medium size fitted into the same box so
they line up (the offline copy's Small version when it can't be loaded), opening full size when clicked. Under each
are its title or file name, whether it's in the Gallery or in flight, the **Draft** mark, and when, with what and how
it was taken: the date (the custom one, or else the EXIF one), camera, lens (the custom lens, or else the EXIF one),
settings and size in pixels. Each has:

- **Pick as winner**, which makes it the group's one winner, outlined in amber; clicking **Winner** again unpicks it.
- **Edit**, which opens it on the Photo page, as the Gallery or Photos in Flight would, to give the winner a title.
- **Take out**, which leaves it as it was before it joined.

**Finish comparing**, after asking, takes every photo out of the group and goes back to the list. With a winner
picked, the dialog offers to set the untitled photos that didn't win aside as Undecided (checked by default). Photos
with a title are left as they are, on the portfolio or in flight: finishing never unpublishes anything.

> **ELI5:** it's a photo contest with a sign-up sheet. Each photo wears a name tag saying which contest it's in, the
> judge puts a ribbon on one, and when the contest ends everyone takes their name tag off.

## Where it's kept

A group is the photo JSON's `compareGroup`, the group's name, and the winner's `compareWinner: true`. Like the
[Undecided](photos-in-flight.md#undecided) mark, they're [local edits](combined-data-store.md#local-edits), kept in the
browser's `localStorage` until **Commit** saves them to each file. Taking a photo out, or finishing, sets them to `null`
rather than `false`, so the photo is as it was; a photo that never had them gets no change. Because they're local
edits, groups work [offline](offline-mode.md), are copied into the in-flight backup there, and go along with
**Export** and **Import**. Putting a Gallery photo in a group changes its file at the next Commit, so it's then listed in
Photos in Flight like any other edit.

The page reads the same photos as the Gallery (`GET /api/photos/published`) and Photos in Flight
(`GET /api/photos/in-flight`), with a photo in flight taking the place of its copy on the base branch. Removed photos
and ones whose JSON couldn't be read can't be compared. The rules are in `lib/compare-groups.ts` and
`hooks/use-compare-groups.ts`.

> **Frontend analogy:** there's no "groups" table. A group is a `GROUP BY compareGroup` over the photos, done in
> `useMemo`, like deriving a tag cloud from posts rather than storing it.
