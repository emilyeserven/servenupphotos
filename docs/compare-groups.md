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
winners when any are picked, and its first four Square Thumbnails (from the [offline copy](offline-mode.md)), the
winners' outlined. A card opens the group at `/compare?group=<name>`. Under the groups is
[Unselected Photos](#unselected-photos).

There, the group's photos sit side by side, two or three across, each at its Medium size fitted into the same box so
they line up (the offline copy's Small version when it can't be loaded), opening full size when clicked. Under each
are its title or file name, whether it's in the Gallery or in flight, the **Draft** mark, and when, with what and how
it was taken: the date (the custom one, or else the EXIF one), camera, lens (the custom lens, or else the EXIF one),
settings and size in pixels. Each has:

- **Pick as winner**, which makes it one of the group's winners, outlined in amber. A group can have several, such as
  two frames that both get posted; clicking **Winner** again unpicks it.
- **Edit**, which opens it on the Photo page, as the Gallery or Photos in Flight would, to give a winner a title.
- **Take out**, which leaves it as it was before it joined.

**Finish comparing**, after asking, takes every photo out of the group and goes back to the list. With winners picked,
it asks what happens to the photos that didn't win:

- **Move to Unselected Photos** (the default), with an optional reason for all of them, and what's left of them in R2:
  - **Keep only their Small versions and thumbnails** (the default): deletes the original and the XLarge, Large and
    Medium versions, keeping Small, XSmall, Preview, the Square Thumbnail and the Thumbnail Preview.
  - **Delete them from R2**: deletes the original, every version and both thumbnails.
  - **Keep them in R2**: deletes nothing.
- **Leave them as they are**, optionally setting the untitled ones aside as Undecided (checked by default). Photos with a
  title stay on the portfolio or in flight.

Deleting happens at once, through Explore Bucket's delete (`POST /api/photos/bucket/delete`), one photo at a time, so it
needs the internet. When any of a photo's files can't be deleted, the dialog lists which and why, and **Finish anyway**
moves it to Unselected Photos as still in R2, from where it can be deleted again. Each version's key is worked out
from the original's (its JSON's `images.key`, else `images.full`, else the image found in R2) as
`<original without its extension>-<version>.webp`, the way uploads name them.

> **ELI5:** it's a photo contest with a sign-up sheet. Each photo wears a name tag saying which contest it's in, the
> judge puts ribbons on the best ones, and when the contest ends everyone takes their name tag off. The ones without a
> ribbon go in a scrapbook with a note saying why, and their big prints can be thrown away to save space.

## Unselected Photos

The Compare page's **Unselected Photos** (`/compare#unselected`) lists, newest first, the photos that didn't win when
their group was finished. Each shows its Small version from the [offline copy](offline-mode.md) (or its Square
Thumbnail), the group it lost in, the day, what's left of it in R2, and:

- **Why it wasn't chosen**, a box saved when it loses focus.
- **Chosen instead**: the winners' Square Thumbnails, outlined in amber, each opening that photo on the Photo page, and
  a box to add any photo as a winner or take one out.
- **Keep only Small versions in R2** while it's all there, or **Delete the rest from R2** while its Small versions are,
  each asking **Delete for good?** first.
- **Move back**, which takes it out of Unselected Photos. Its images stay as they are, so one deleted from R2 stays without
  them.

An unselected photo is marked **Unselected** in the Gallery and Photos in Flight (linked here), and **Next untitled
photo** skips it.

### Off the portfolio

Its images may be gone from R2, so **Commit always leaves an unselected photo out of `ALLPHOTOS.json`**, the way it
leaves out a [draft](drafts.md), even with **Keep untitled photos as drafts** turned off, and takes out its entry if it
had one, so a Gallery photo that lost leaves the portfolio when the pull request merges. Its own JSON file stays. The
rule is `isUnselected` in `apps/be-pipeline/internal/github/drafts.go` and in `apps/client-pipeline/src/lib/drafts.ts`,
which the **Combine photo data** workflow's `jq` filter and `pnpm photos:local` match.

> **Frontend analogy:** it's a soft delete: the row stays with a `deletedAt`-style field, and the public query filters
> it out, while the admin screen still lists it with a way to restore it.

## Where it's kept

A group is the photo JSON's `compareGroup`, the group's name, and each winner's `compareWinner: true`. A photo that
didn't win has `unselected`: `{ reason, winners, group, date, images }`, where `winners` are the IDs of the photos
chosen over it, `date` is the day as `YYYY-MM-DD`, and `images` is what's left in R2 (`kept`, `small` or `deleted`). Like the
[Undecided](photos-in-flight.md#undecided) mark, they're [local edits](combined-data-store.md#local-edits), kept in the
browser's `localStorage` until **Commit** saves them to each file. Taking a photo out, finishing, or moving it back sets them to `null`
rather than `false`, so the photo is as it was; a photo that never had them gets no change. Because they're local
edits, groups work [offline](offline-mode.md), are copied into the in-flight backup there, and go along with
**Export** and **Import**. Putting a Gallery photo in a group changes its file at the next Commit, so it's then listed in
Photos in Flight like any other edit.

The page reads the same photos as the Gallery (`GET /api/photos/published`) and Photos in Flight
(`GET /api/photos/in-flight`), with a photo in flight taking the place of its copy on the base branch. Removed photos
and ones whose JSON couldn't be read can't be compared. The rules are in `lib/compare-groups.ts`, `lib/unselected.ts`,
`hooks/use-compare-groups.ts` and `hooks/use-discard-images.ts`.

> **Frontend analogy:** there's no "groups" table. A group is a `GROUP BY compareGroup` over the photos, done in
> `useMemo`, like deriving a tag cloud from posts rather than storing it.
