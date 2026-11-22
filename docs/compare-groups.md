# Compare groups

A **compare group** holds photos weighed head-to-head to decide which one gets posted, such as three frames of the same lantern street. Any photo from the [Gallery](gallery.md) or [Photos in Flight](photos-in-flight.md) can go in one, drafts and [Undecided](photos-in-flight.md#undecided) photos included. Groups are only in the pipeline: the portfolio never reads or shows them.

## Putting a photo in a group

**Compare** (a scale icon) is on each Gallery tile (an icon in its [button group](gallery.md), named on hover), on each photo in flight beside **Undecided**, and on each draft tile under **Drafts on `<branch>`**. It opens a dialog to choose a group, or to type a name and **Start a group named “…”**. A photo is in at most one group, so choosing another moves it. Once a photo is in a group, its button shows the group's name, and the dialog adds **Compare “…”**, to open the group, and **Take out of the group**.

## Near duplicates

A photo that looks nearly the same as one already saved, such as another frame of the same burst, a re-export or a small crop, isn't turned away: saving it (on the Photo page or in [Bulk Upload](bulk-upload.md)) puts it in a compare group with the photos it looks like, so they can be weighed here. The group is the one those photos are in already, or else a new one called **Near duplicates of** the first one's title or file name. Photos in another group stay in it, and [unselected](#unselected-photos) photos are left out, since their images may be gone. The Photo page and Bulk Upload say which group it went in, linked to it. The same photo saved twice (the same file name, GPS position and creation date) is still stopped by the already-saved check, since there's nothing to weigh.

**Find near duplicates**, above the groups on the Compare page, has the backend do the same for every saved photo (`POST /api/data/near-duplicates`): each photo without a perceptual hash gets one, then each set of photos that look nearly the same, directly or by way of each other, goes in a group the same way. It says how many photos it put in how many groups, and how many it couldn't check because their Small version couldn't be read. Everything it changes, the hashes included, waits for **Commit** like any other save.

The look is the photo file's `perceptualHash`, a difference hash (dHash) made in `internal/phash`: the photo's Small version (500 pixels on the longest edge, from the [offline copy](offline-mode.md) when it's there, else from R2) shrunk to 9 × 8 grey pixels, with one bit for each pair of pixels side by side, set when the left one is brighter. Two photos are near duplicates when their 64 bits differ in at most 10 (`phash.Near`); unrelated photos differ in about 32. Making one takes well under a millisecond, and comparing a photo with a few thousand others is a loop over 64-bit numbers, so it needs no model or service. It doesn't find the same scene from another angle, which only an image model could. The rules are in `apps/be-pipeline/internal/github/nearduplicates.go`.

> **ELI5:** it's squinting at two photos until each is a blurry blob of light and dark. If the blobs match, they're probably the same shot.

> **Frontend analogy:** like a content hash for cache busting, except that a small change to the image only flips a few bits rather than all of them, so "how many bits differ" works like a similarity score: `popcount(a ^ b) <= 10`.

## The Compare page

`/compare` (**Compare** in the sidebar, under **Pipeline**) lists every group as a card with its photo count, its winners when any are picked, and its first four Square Thumbnails (from the [offline copy](offline-mode.md)), the winners' outlined. A card opens the group at `/compare?group=<name>`. Under the groups is [Unselected Photos](#unselected-photos).

There, the group's photos sit side by side, two or three across, each at its Medium size fitted into the same box so they line up (the offline copy's Small version when it can't be loaded), opening full size when clicked. Under each are its title or file name, whether it's in the Gallery or in flight, the **Draft** mark, and when, with what and how it was taken: the date (the custom one, or else the EXIF one), camera, lens (the custom lens, or else the EXIF one), settings and size in pixels.

Clicking a photo opens it full size, saying which it is of the group (such as **3 of 4**). There, **←** and **→** (or the arrows at the image's sides) move to the previous or next photo, going round from the last to the first, so the group can be flicked through at full size. **W** picks or unpicks the photo shown as a winner and **L** marks it Lower Tier or takes the mark off, the same as the **Pick as winner** and **Lower Tier** buttons under it. **Esc** closes it and puts focus back on the photo last shown. Keys held with Ctrl, Alt or ⌘ are left to the browser. The keys are in `lib/compare-keys.ts`.

Each photo has:

- **Pick as winner**, which makes it one of the group's winners, outlined in amber. A group can have several, such as two frames that both get posted; clicking **Winner** again unpicks it.
- **Lower Tier**, which marks it a [Lower Tier](lower-tier.md) photo (or takes the mark off), for a frame that won't be posted but is still worth putting in an album or a trip line. It stays in the group, and is marked **Lower Tier** under its name.
- **Edit**, which opens it on the Photo page, as the Gallery or Photos in Flight would, to give a winner a title.
- **Take out**, which leaves it as it was before it joined.

**Finish comparing**, after asking, takes every photo out of the group and goes back to the list. With winners picked, it asks what happens to the photos that didn't win:

- **Move to Unselected Photos** (the default), with an optional reason for all of them, and what's left of them in R2:
  - **Keep only their Small versions and thumbnails** (the default): deletes the original and the XLarge, Large and Medium versions, keeping Small, XSmall, Preview, the Square Thumbnail and the Thumbnail Preview.
  - **Delete them from R2**: deletes the original, every version and both thumbnails.
  - **Keep them in R2**: deletes nothing.
- **Leave them as they are**, optionally setting the untitled ones aside as Undecided (checked by default). Photos with a title stay on the portfolio or in flight.

Deleting happens at once, through Explore Bucket's delete (`DELETE /api/photos/bucket`), one photo at a time, so it needs the internet. When any of a photo's files can't be deleted, the dialog lists which and why, and **Finish anyway** moves it to Unselected Photos as still in R2, from where it can be deleted again, while **Try again** deletes those photos' files once more. Once deleting starts, the dialog can't be closed without finishing, since the losers already deleted have to be marked as unselected or they'd be left as drafts without images. Each version's key is worked out from the original's (its JSON's `images.key`, else `images.full`, else the image found in R2) as `<original without its extension>-<version>.webp`, the way uploads name them.

> **ELI5:** it's a photo contest with a sign-up sheet. Each photo wears a name tag saying which contest it's in, the judge puts ribbons on the best ones, and when the contest ends everyone takes their name tag off. The ones without a ribbon go in a scrapbook with a note saying why, and their big prints can be thrown away to save space.

## Autogroup

**Autogroup** (`/compare/autogroup`, under **Compare** in the sidebar) has an LLM find photos that are generally too similar to all be posted, not only near duplicates, and puts them in compare groups. It can also tidy the groups there are: add photos to them, combine them, or remove them. It doesn't call an LLM itself: it copies a prompt to paste into a chat with one, the way [Genre Suggestions](photographic-genres.md) does, and reads the JSON answer pasted back.

- **All photos** or **Draft photos** chooses which photos in no group the prompt asks about. Draft photos are the untitled ones and the ones set aside as Undecided (`isDraft`). Either way, [unselected](#unselected-photos) photos (their images may be gone) and photos without an image are left out. Every chosen photo goes in one prompt, with no limit, oldest first by the custom date or else the EXIF one.
- **Let it change the groups there are** (on by default) also sends every compare group with its photos, each winner marked, so the LLM can add photos to one, combine some, or remove one. Turned off, the prompt asks only for new groups.

**Copy the Autogroup prompt** copies, for each photo, its JSON file's name (such as `20161216_092741`), a link to its Small version (500 pixels on the longest edge, else Medium, else the original, like the tag prompt), when it was taken and its title. The button next to it shows the whole prompt in a modal, which also opens when the browser won't copy, as on a plain HTTP address. The prompt asks for groups of any size, 2 photos or more, that are too similar for someone scrolling the portfolio not to feel they'd seen it already: near-identical frames, but also the same subject or view shot another time or from another angle, or the same composition or idea, even on different days. Photos that only share a theme, a color or a place aren't grouped. Each photo goes in at most one group. The answer is:

```json
{
  "groups": [
    { "name": "Lantern Street at Dusk", "photos": ["20161216_092741", "20161216_092745"] }
  ],
  "merge": [{ "groups": ["Harbor Boats", "Boats at the Pier"], "name": "Harbor Boats" }],
  "remove": [{ "group": "Red Doors", "reason": "The two doors are on different streets." }]
}
```

A `groups` entry with the name of a group there is adds its photos to that group.

**Make contact sheets**, above the copy button, puts the prompt's photos (the ones in no group, then each group's) on numbered sheets of 30 in R2 first, so the prompt links a few sheets for the LLM to look through and keeps each photo's own link for a closer look ([Contact sheets](contact-sheets.md)).

**Review the changes** reads the pasted answer (a code fence or a sentence around the JSON is fine) in the browser and lists each change with a box to leave it out:

- **Remove “…”**, with the LLM's reason: its photos leave the group, as **Take out** would, winners unpicked.
- **Combine into “…”**: every photo of the groups goes in the one named (one of theirs or a new one; the first group's when it gives none), keeping its winners.
- A new group, or photos to **add to the group there is**, with any photo it moves out of another group.

A photo or group the answer names that isn't in the prompt is still found among every photo (leaving out unselected ones) and every compare group, so an answer written for another prompt still applies; names that aren't any photo's or group's are listed and skipped, a photo named twice stays in its first group, a group left with fewer than 2 photos, counting the ones in it already, is dropped, a group is combined at most once, and a group being combined isn't also removed. **Make … changes to compare groups** makes the removals, then the combinations, then the new groups and additions, so a photo the answer moves out of a removed group still ends up where it said. They're the same `compareGroup` [local edits](#where-its-kept) the Compare dialog makes, waiting for **Commit**. The rules are in `lib/compare-autogroup.ts` (the prompt) and `lib/compare-autogroup-answer.ts` (reading the answer).

> **Frontend analogy:** it's a form whose "server" is a chat window. The page serializes the photos into a prompt, the LLM is the API, and pasting its JSON back is the response, which the page validates like any untrusted `fetch` body before it touches state.

## Unselected Photos

The Compare page's **Unselected Photos** (`/compare#unselected`) lists, newest first, the photos that didn't win when their group was finished. Each shows its Small version from the [offline copy](offline-mode.md) (or its Square Thumbnail), the group it lost in, the day, what's left of it in R2, and:

- **Why it wasn't chosen**, a box saved when it loses focus.
- **Chosen instead**: the winners' Square Thumbnails, outlined in amber, each opening that photo on the Photo page, and a box to add any photo as a winner or take one out.
- **Keep only Small versions in R2** while it's all there, or **Delete the rest from R2** while its Small versions are, each asking **Delete for good?** first.
- **Move back**, which takes it out of Unselected Photos. Its images stay as they are, so one deleted from R2 stays without them.

An unselected photo is marked **Unselected** in the Gallery and Photos in Flight (linked here), is left out of Photos in Flight's **Drafts on `<branch>`**, and **Next untitled photo** skips it.

### Off the portfolio

Its images may be gone from R2, so **Commit always leaves an unselected photo out of `ALLPHOTOS.json`**, the way it leaves out a [draft](drafts.md), even with **Keep untitled photos as drafts** turned off, and takes out its entry if it had one, so a Gallery photo that lost leaves the portfolio when the pull request merges. Its own JSON file stays. The rule is `isUnselected` in `apps/be-pipeline/internal/github/drafts.go` and in `apps/client-pipeline/src/lib/drafts.ts`, which the **Combine photo data** workflow's `jq` filter and `pnpm photos:local` match.

> **Frontend analogy:** it's a soft delete: the row stays with a `deletedAt`-style field, and the public query filters it out, while the admin screen still lists it with a way to restore it.

## Where it's kept

A group is the photo JSON's `compareGroup`, the group's name, and each winner's `compareWinner: true`. A photo that didn't win has `unselected`: `{ reason, winners, group, date, images }`, where `winners` are the IDs of the photos chosen over it, `date` is the day as `YYYY-MM-DD`, and `images` is what's left in R2 (`kept`, `small` or `deleted`). Like the [Undecided](photos-in-flight.md#undecided) mark, they're [local edits](combined-data-store.md#local-edits), kept in the browser's `localStorage` until **Commit** saves them to each file. Taking a photo out, finishing, or moving it back sets them to `null` rather than `false`, so the photo is as it was; a photo that never had them gets no change. Because they're local edits, groups work [offline](offline-mode.md), are copied into the in-flight backup there, and go along with **Export** and **Import**. Putting a Gallery photo in a group changes its file at the next Commit, so it's then listed in Photos in Flight like any other edit.

The page reads the same photos as the Gallery (`GET /api/photos/published`) and Photos in Flight (`GET /api/photos/in-flight`), with a photo in flight taking the place of its copy on the base branch. Removed photos and ones whose JSON couldn't be read can't be compared. The rules are in `lib/compare-groups.ts`, `lib/unselected.ts`, `hooks/use-compare-groups.ts` and `hooks/use-discard-images.ts`.

> **Frontend analogy:** there's no "groups" table. A group is a `GROUP BY compareGroup` over the photos, done in `useMemo`, like deriving a tag cloud from posts rather than storing it.
