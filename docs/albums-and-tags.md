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
or `ALLTAGS.json` at once, until a **Commit** writes it there. A new album can have a **Parent album**. Albums are listed as a tree, sub-albums under their parent,
with how many photos in `ALLPHOTOS.json` list each one.

Each name links to its page (`/albums/<id>` or `/tags/<id>`), which shows its file and status, an album's parents, a
**Sub-albums** panel under **Parent album** listing every album inside it as a tree with photo counts, and the photos `ALLPHOTOS.json` lists in it (at the pull request's head when one is open, from the
[combined data store](combined-data-store.md)), optionally with the ones in its sub-albums. An album's page can change its
parent (`PUT /api/organize/albums/<id>/parent` with `{ "parent": "<id>" | null }`), which rewrites only the file's
`parent`, as a [change waiting for Commit](pending-changes.md), refusing a parent that's the album itself or inside it.

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
or tag on GitHub). The Photo page has an **Albums and tags** card for a new photo, saved with **Save**, and
for a photo being edited, saved with **Save changes**.

## Suggest tags

When a photo is being edited, the Photo page's **Suggest tags** card (under **Albums and tags**) helps an LLM pick its
tags. **Copy tag prompt** copies a prompt to paste into a chat with any LLM that can see images (`lib/tag-prompt.ts`).
It has:

- A link to the photo's **Small** version (500px on its long edge), or its Medium one when it has no Small. At 500 ×
  333 that's about 220 tokens for Claude (width × height ÷ 750), one 512px tile for GPT-4o and about one 258-token
  tile for Gemini, against roughly 1,300 for Claude at Medium's 1200px, and it still shows the subject clearly. The
  X-Small (250px) loses too much detail. Sources: [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision),
  [OpenAI image costs](https://community.openai.com/t/how-do-i-calculate-image-tokens-in-gpt4-vision/492318),
  [Gemini tokens](https://ai.google.dev/gemini-api/docs/tokens).
- Every tag's ID, to reuse when one fits, spelled as listed.
- Every album and [metadata group](metadata-groups.md) name, under **Already filtered**, since the portfolio already
  filters by them.
- The rules: every tag in lowercase kebab-case (`street-food`); tags general enough to fit other photos; cultural terms and concepts first, then the main subjects; a
  kind of place ("mosque", "temple", "lake", "city") but never a named one; nothing the site already filters by
  (place, camera, lens, focal length, aperture, exposure, ISO, date, colors and vividness, albums); 3 to 8 tags; and
  only a comma-separated list in the answer.

Once it's copied, a field takes the LLM's answer. **Add tags** splits it at commas and new lines, takes off quotes,
bullets and trailing dots, drops repeats (ignoring case), and matches each name to a tag by its name or the ID made
from it, ignoring case, so `Street Food` matches `street-food`. Matching tags are added to the photo's tags in **Albums and tags**, as an edit that **Save
changes** saves (and **Commit** sends to GitHub, like any other). A name an album or metadata group already has, or
one with nothing to make an ID from, is left out, saying why. The rest are listed as new tags in lowercase kebab-case, each with a checkbox:
**Make N new tags and add them** saves the ticked ones as tag files (`POST /api/organize/tags`, changes waiting for
Commit, like **New tag** on `/tags`) and adds them to the photo.

> **Frontend analogy:** it's a copy-to-clipboard "share" template plus an import box, like pasting a CSV of labels
> into a multi-select: the box normalizes and dedupes the strings, matches them against the select's options, and
> offers to create the options that don't exist yet.
