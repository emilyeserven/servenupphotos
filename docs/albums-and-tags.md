# Albums and Tags

`/albums` and `/tags`, under **Organize** in the sidebar, add new albums and tags. Each page lists every album or tag
on the Settings branch and in the open **Add photo data** pull request, marking the ones not merged yet as in flight
(`GET /api/organize` → `GET /organize`). **New album** (or **New tag**) asks for a name and an optional description. Its ID is
made from the name (lowercase, accents dropped, anything other than a to z and 0 to 9 turned into dashes, so
`Busan, South Korea` becomes `busan-south-korea`), and the form warns while you type when an album or tag already has
that name or ID, or when the name has nothing to make an ID from (such as `東京` on its own). A tag's name is always
its ID, in lowercase kebab-case: **New tag** saves `Street Food` as `street-food`, and the backend refuses a tag whose
name isn't its ID. When older tags have other names, the Tags page lists them under **Tag names to fix**, whose
**Rename** button saves each one's name as its ID (`PUT /api/organize/tags/names`), as changes waiting for Commit.
Photos list tags by ID, so no photo changes. Saving
(`POST /api/organize/{albums,tags}`) checks again on GitHub, then adds `<folder>/albums/<id>.json` (or `tags/`) to the
open photo data pull request, or opens one, the same way photos are saved, and shows it in `ALLALBUMS.json`
or `ALLTAGS.json` at once, until a **Commit** writes it there. A new album can have a **Parent album**, and a new tag a **Parent tag**. Albums and tags are listed as a tree, each under its parent,
with how many photos in `ALLPHOTOS.json` list each one.

Each name links to its page (`/albums/<id>` or `/tags/<id>`), which shows its file and status, an album's parents, a
**Sub-albums** panel under **Parent album** listing every album inside it as a tree with photo counts, and the photos `ALLPHOTOS.json` lists in it (at the pull request's head when one is open, from the
[combined data store](combined-data-store.md)), optionally with the ones in its sub-albums. An album's page can change its
parent (`PUT /api/organize/albums/<id>/parent` with `{ "parent": "<id>" | null }`), which rewrites only the file's
`parent`, as a [change waiting for Commit](pending-changes.md), refusing a parent that's the album itself or inside it.

## Adding photos

**Add photos**, on the **Photos** card of an album's page, opens the saved photos that aren't in the album yet (in
the photo data pull request or the portfolio, the same ones the Photo page's **Choose a saved photo** lists), with a
search by title or file name, the [Gallery](gallery.md)'s **Title**, **Place**, **GPS position**, **Albums**,
**Tags**, **Genres** and **Re-edit mark** filters and its **Sort** (**Date taken**, **Date added**, **Time of day**),
and under those the portfolio Grid's **Show filters** (places, album, tag, genre, camera, lens, the setting sliders
and colors). They're the Gallery's own components, kept in the album page's URL the same way (`?hasTitle=with`,
`?sort=added`, `?camera=…`), so they're still set the next time the modal opens; **Clear filters** clears them all.
Each tile says whether the photo is only in the batch and how many albums it's in already.
Click as many as you like, then **Add N photos**: it adds the album to each one's `albums` (`POST /api/photos/groups`,
the same save as the Gallery's **Add albums, tags and genres** card), keeping the albums each is in, as one change
waiting for Commit. The photos show on the page at once; a draft (a photo with no title) doesn't, since
`ALLPHOTOS.json` leaves drafts out.

> **Frontend analogy:** it's a multi-select modal whose "Done" button sends one batched `PATCH` for every chosen row,
> rather than a request per click.

## Photo order

An album's page shows its photos in the album's order, the one the portfolio uses. **Reorder**, on the **Photos** card
of an album with more than one photo, turns the photos into tiles to drag into a new order, each numbered with its
place and with arrows that move it one place earlier or later (for a keyboard or a touch screen). **Save order** saves
the photo IDs in their new order as the album file's `photoOrder` (`PUT /api/organize/albums/<id>/photo-order` with
`{ "photoIds": [...] }`), a [change waiting for Commit](pending-changes.md); **Cancel** leaves it as it was. With
**Include sub-albums** ticked, the sub-albums' photos are put in order too; with it unticked, the IDs the order already
lists that aren't shown are kept after the others. A photo the order doesn't list, such as one added to the album
later, comes after the ones it lists, in the default order: photos with an old homepage place (`websiteSpotlight`)
first, then the rest, newest first. **Use the default order** saves an empty `photoOrder`, putting them all back.

> **Frontend analogy:** like a sortable list that saves an array of IDs rather than an index on each item, so a photo
> can be in several albums with a different place in each, and a new item simply goes on the end.

To lay the album's page out in rows with text above and below them, and to pick its cover photos, use the
**Layout and covers** card under it; see [Album Layouts and Covers](album-layouts.md).

## Showing or hiding on the portfolio

The **On the portfolio** card, on an album's page, hides the album on the portfolio or shows it again
(`PUT /api/organize/albums/<id>/visibility` with `{ "hidden": true | false }`), writing only the file's `hidden`, as a
[change waiting for Commit](pending-changes.md). A hidden album, and every album inside it, isn't on the portfolio's
[Albums](portfolio-albums.md) page or in the Grid's **Album** filter, and its own page says there's no such album. Its
photos still show everywhere else, and a [spotlight zone](publish.md#site-spotlight) that shows it still does, so an
album like **Homepage Spotlight** can feed the homepage without being listed. The card says when an album is hidden
because one it's inside is, and the Albums list marks each hidden album with **Hidden on the portfolio**.

> **Frontend analogy:** like a `published: false` flag on a CMS entry: the entry and its data stay, and only the
> public list and detail routes skip it, the same as a filtered-out row rather than a deleted one.

## Parent tags

A tag can have one parent tag: a more general tag it's a kind of, such as `shotengai` (a Japanese shopping street)
under `covered-street`. That links a culture's own word to the general idea, so the portfolio's **Tag** filter for
`covered-street` shows the `shotengai` photos too, and lists `shotengai` under it. A tag's page shows where it sits
(**Under**) and has a **Parent tag** card that changes it (`PUT /api/organize/tags/<id>/parent`), the same way an
album's parent changes; a genre has no parent. To tidy the whole tree at once, with an LLM suggesting tags to merge,
remove or put under another, use [Tag pruning](update-data.md#tag-pruning) on Update Data.

> **Frontend analogy:** it's a category tree like a shop's "Shoes › Sneakers": filtering by the parent category
> includes every product in the categories under it.

## Order

The Albums list has up and down arrows by each album that move it one place among the albums in the same parent. A move
saves every album's place as its file's `order`, 1 first (`PUT /api/organize/albums/order` with `{ "ids": [...] }`, every
album in its new order), rewriting only the files whose place changed, as changes waiting for Commit. Albums are listed
by `order`, the ones without one after, by name, here, in every album picker and on the portfolio's
[Albums](portfolio-albums.md) page. An album file can also list the spotlight zones that show it, in `spotlightZones`;
see [Site Spotlight](publish.md#site-spotlight).

> **Frontend analogy:** like a sortable list that saves the index of every item after a drag, rather than only the one
> that moved, so the numbers never collide.

Every album and tag picker, here, on the Photo page and in the Gallery, is a combobox: type to filter, arrow keys and
Enter to choose, and each choice shows as a chip with a button to remove it (a chip is red when its ID isn't an album
or tag on GitHub, and green when it's new, waiting for Commit, such as a tag just made from a paste). The Photo page has an **Albums and tags** card for a new photo, saved with **Save**, and
for a photo being edited, saved with **Save changes**.

## Suggest tags

When a photo is being edited, the sparkle button in the Photo page's **Tags** field, left of its caret, helps an LLM
pick its tags: it copies a prompt to paste into a chat with any LLM that can see images (`lib/tag-prompt.ts`), and
shows a check for a moment once it has. The Photo page's fields don't link to the Albums, Tags, Genres or Places
pages; those are in the sidebar. The prompt has:

- A link to the photo's **Small** version (500px on its long edge), or its Medium one when it has no Small. At 500 ×
  333 that's about 220 tokens for Claude (width × height ÷ 750), one 512px tile for GPT-4o and about one 258-token
  tile for Gemini, against roughly 1,300 for Claude at Medium's 1200px, and it still shows the subject clearly. The
  X-Small (250px) loses too much detail. Sources: [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision),
  [OpenAI image costs](https://community.openai.com/t/how-do-i-calculate-image-tokens-in-gpt4-vision/492318),
  [Gemini tokens](https://ai.google.dev/gemini-api/docs/tokens).
- What's known of where the photo was taken (its title, places, place name, EXIF and hand-written city, state,
  country and GPS position, and comment), the same lines the [location prompt](places-and-localizations.md#suggest-a-location) sends,
  so the LLM only uses a culture's own word (such as "shotengai", a Japanese shopping street) for a photo from that culture, without making a tag
  of the place itself.
- Every tag's ID, to reuse when one fits, spelled as listed.
- Every album, [photographic genre](photographic-genres.md) and [metadata group](metadata-groups.md) name, under **Already filtered**, since the portfolio already
  filters by them.
- The rules: answer with the tags on one comma-separated line, then a short definition of each cultural term among
  them, one per line as `tag: definition`, ending with `(parent: general-tag)` when the term is a local kind of
  something more general (the parent isn't added to the tag line); every tag in lowercase kebab-case (`street-food`); tags general enough to fit other photos; cultural terms and concepts first, then the main subjects; a
  kind of place ("mosque", "temple", "lake", "city") but never a named one; nothing the site already filters by
  (place, camera, lens, focal length, aperture, exposure, ISO, date, colors and vividness, albums, genre); and 3 to 8 tags.

Paste the LLM's answer into the **Tags** field. Every Tags field (on the Photo page and the Gallery's bulk card) takes
a pasted comma-separated list: text with a comma or a new line in it isn't typed into the search, but split at commas
and new lines, with quotes, bullets and trailing dots taken off and repeats dropped (ignoring case). Lines that define a tag
(`tag: definition`) aren't tags: a new tag a line defines is listed with its definition, which becomes its
description when it's made. A parent a line suggests is shown under the new tag with a checkbox, ticked to start
with: making the tag puts it under that parent, making the parent first when it isn't a tag yet (without adding it
to the photo). Each name is
matched to a tag by its name or the ID made from it, ignoring case, so `Street Food` matches `street-food`, and the
matching tags are added to the field, as an edit saved like any other (and sent to GitHub by **Commit**). A name an
album, genre or metadata group already has, or one with nothing to make an ID from, is left out, saying why. The rest
are listed under the field as new tags in lowercase kebab-case, each with a checkbox: **Make N new tags and add them**
saves the ticked ones as tag files (`POST /api/organize/tags`, changes waiting for Commit, like **New tag** on
`/tags`) and adds them to the field, then hides the list, leaving one line that names the tags it added.

To tag up to five related photos with one prompt, use [Bulk tagging](update-data.md#bulk-tagging) on Update Data,
which shares these rules (`TAG_RULES` in `lib/tag-prompt.ts`).

> **Frontend analogy:** it's a copy-to-clipboard "share" template plus an `onPaste` handler on a multi-select, like
> pasting a CSV of labels into it: the handler normalizes and dedupes the strings, matches them against the select's options, and
> offers to create the options that don't exist yet.
