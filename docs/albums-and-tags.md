# Albums and Tags

`/albums` and `/tags`, under **Organize** in the sidebar, add new albums and tags. Each page lists every album or tag
on the Settings branch and in the open **Add photo data** pull request, marking the ones not merged yet as in flight
(`GET /api/organize` → `GET /organize`). **New album** (or **New tag**) asks for a name and an optional description. Its ID is
made from the name (lowercase, accents dropped, anything other than a to z and 0 to 9 turned into dashes, so
`Busan, South Korea` becomes `busan-south-korea`), and the form warns while you type when an album or tag already has
that name or ID, or when the name has nothing to make an ID from (such as `東京` on its own). Saving
(`POST /api/organize/{albums,tags}`) checks again on GitHub, then adds `<folder>/albums/<id>.json` (or `tags/`) to the
open photo data pull request, or opens one, the same way photos are saved, and shows it in `ALLALBUMS.json`
or `ALLTAGS.json` at once, until a **Commit** writes it there. A new album can have a **Parent album**. Albums are listed as a tree, sub-albums under their parent,
with how many photos in `ALLPHOTOS.json` list each one.

Each name links to its page (`/albums/<id>` or `/tags/<id>`), which shows its file and status, an album's parents, a
**Sub-albums** panel under **Parent album** listing every album inside it as a tree with photo counts, and the photos `ALLPHOTOS.json` lists in it (at the pull request's head when one is open, from the
[combined data store](combined-data-store.md)), optionally with the ones in its sub-albums. An album's page can change its
parent (`PUT /api/organize/albums/<id>/parent` with `{ "parent": "<id>" | null }`), which rewrites only the file's
`parent`, as a [change waiting for Commit](pending-changes.md), refusing a parent that's the album itself or inside it.

Every album and tag picker, here, on the Photo page and in the Gallery, is a combobox: type to filter, arrow keys and
Enter to choose, and each choice shows as a chip with a button to remove it (a chip is red when its ID isn't an album
or tag on GitHub). The Photo page has an **Albums and tags** card for a new photo, saved with **Save**, and
for a photo being edited, saved with **Save changes**.
