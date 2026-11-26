# Photographic Genres

`/genres`, under **Organize** in the sidebar as **Genres**, lists the kinds of photography a photo can be, such as Street, Landscape, Portrait or Architecture. It works the same way as the [Tags](albums-and-tags.md) page: **New genre** asks for a name and an optional description, makes the ID from the name, warns when an album, tag or genre already has that name or ID, and saves `<folder>/genres/<id>.json` (`POST /api/organize/genres`) as a [change waiting for Commit](pending-changes.md). **Commit** combines the genre files into `genres/ALLGENRES.json`. The list shows every genre on the Settings branch and in the open **Add photo data** pull request, by name, with how many photos in `ALLPHOTOS.json` list it, and each name links to its page (`/genres/<id>`) with its file, status and photos.

A genre file is `{ "id", "name", "description" }`, like a tag's, plus `parent` and `order` once it's been placed (see below). Genres share one set of IDs and names with albums and tags, compared ignoring case, so a photo's `albums`, `tags` and `genres` never mean the same thing.

## Subgenres

A genre can be a subgenre of one broader genre, such as Traditional architecture under Architecture. Its file's `parent` is the broader genre's ID (missing or `null` at the top level), the same as a [parent tag](albums-and-tags.md#parent-tags). **New genre** has an optional **Parent genre**, a genre's page shows where it sits (**Under**) and has a **Parent genre** card that changes it (`PUT /api/organize/genres/<id>/parent`), and the Genres list shows each subgenre indented under its genre. The pipeline never lets a genre end up under itself.

A photo lists only the genres it was given, so a photo of `traditional-architecture` keeps `["traditional-architecture"]`. Everywhere that filters or counts by genre reads the tree instead: the portfolio's **Genres** filter for Architecture shows the Traditional architecture photos too and lists the subgenre under it, and the Graph's Genre counts a photo in each genre over its own. The **Photographic genres** combobox lists each subgenre after its genre with "Under Architecture" beneath it, and the Genre Suggestions prompt indents subgenres and asks for the subgenre alone when it fits.

> **Frontend analogy:** a category tree like a shop's "Shoes › Sneakers": the product only stores its most specific category, and filtering by the parent walks down the tree to include every category under it.

## Reorganize Genres

**Genres → Reorganize Genres** (`/reorganize-genres`) shows every genre as a tree to tidy at once. Each row has the genre's name to edit, an **Under** picker to move it under another genre (or back to **Top level**), how many photos list it, and buttons to move it up or down among the genres beside it, out of its parent, or under the genre just above it as a subgenre. A genre moves with its subgenres, and the **Under** picker leaves out the genre itself and the ones under it. Nothing is saved until **Save genres**; **Undo changes** goes back to what's saved, and the button stays off while a name is empty or two genres share one.

Saving sends every genre in its new order (`PUT /api/organize/genres/tree`, `{ "genres": [{ "id", "name", "parent" }] }`), and the backend checks them all before it saves any: every genre listed once, names not empty, not shared, and not an album's or tag's, parents that are genres, and no loops. It then gives each genre file its `order` (1 first), and its `parent` and `name` where they changed, as [changes waiting for Commit](pending-changes.md), leaving the files that already had them alone. IDs never change here, so every photo keeps its genres; renaming only changes the name shown. The Genres page, every genre picker and the portfolio list the genres in this order, then by name for any without one.

> **Frontend analogy:** a controlled form over the whole list: the page edits a local copy of the tree and submits it once, like a drag-and-drop list that PUTs the full array instead of one PATCH per move.

## On a photo

A photo can have several genres. Its JSON lists their IDs in `genres`, after `tags`, and new photos get `"genres": []`. **Update Data → Missing fields** adds the empty list to older files. The Photo page's **Albums, tags and genres** card has a **Photographic genres** combobox, for a new photo (saved with **Save**) and for one being edited (saved with **Save changes**). In that combobox, and in the Gallery's **Add albums, tags and genres**, typing a name that isn't a genre yet offers **Make “…” a new genre** at the end of the list: choosing it checks the name the same way **New genre** does, saves the genre file as a change waiting for Commit, and chooses it for the photo. When an album or tag already has that name or ID, it says so under the field instead. In the Gallery, **Select** → **Add albums, tags and genres** adds genres to every chosen photo (`POST /api/photos/groups` with `genres`), each tile lists its genres, and the **Genres** filter there and on Photos in Flight finds photos with or without any.

**Genres → Genre Suggestions** suggests genres for up to 50 photos without any at a time, with one LLM prompt, and makes the new genres it suggests once they're reviewed. With **Photos with genres** it looks again at photos that have genres, optionally only one genre's (such as Architecture), and its answer replaces their genres. In either mode the LLM can suggest new subgenres under a genre there is, such as Traditional architecture under Architecture, and move photos into them; the review shows each new genre's parent to change before anything is saved. Reorganize Genres links there. See [Update Data](update-data/genre-suggestions.md).

## On the portfolio

The Timeline, Map and Grid have **Genres** in their filters' **Groups** picker, after **Tags** (`?genre=street`), which shows the photos that list that genre. Like **Tags**, it's left out while `ALLGENRES.json` is empty. See [Portfolio Filters](portfolio-filters/groups.md).

> **Frontend analogy:** a genre is another normalized slice next to albums and tags: the photo keeps an array of IDs, and `ALLGENRES.json` is the lookup table that turns them into names, like a `byId` map in a Redux store.
