# Photographic Genres

`/genres`, under **Organize** in the sidebar as **Genres**, lists the kinds of photography a photo can be, such as
Street, Landscape, Portrait or Architecture. It works the same way as the [Tags](albums-and-tags.md) page: **New genre**
asks for a name and an optional description, makes the ID from the name, warns when an album, tag or genre already has
that name or ID, and saves `<folder>/genres/<id>.json` (`POST /api/organize/genres`) as a
[change waiting for Commit](pending-changes.md). **Commit** combines the genre files into `genres/ALLGENRES.json`. The
list shows every genre on the Settings branch and in the open **Add photo data** pull request, by name, with how many
photos in `ALLPHOTOS.json` list it, and each name links to its page (`/genres/<id>`) with its file, status and photos.

A genre file is `{ "id", "name", "description" }`, like a tag's. Genres share one set of IDs and names with albums and
tags, compared ignoring case, so a photo's `albums`, `tags` and `genres` never mean the same thing.

## On a photo

A photo can have several genres. Its JSON lists their IDs in `genres`, after `tags`, and new photos get
`"genres": []`. **Update Data → Missing fields** adds the empty list to older files. The Photo page's **Albums, tags
and genres** card has a **Photographic genres** combobox, for a new photo (saved with **Save**) and for one being
edited (saved with **Save changes**). In that combobox, and in the Gallery's **Add albums, tags and genres**, typing a name that isn't a genre yet offers **Make “…” a new genre** at the
end of the list: choosing it checks the name the same way **New genre** does, saves the genre file as a change waiting
for Commit, and chooses it for the photo. When an album or tag already has that name or ID, it says so under the field
instead. In the Gallery, **Select** → **Add albums, tags and genres** adds genres to every
chosen photo (`POST /api/photos/groups` with `genres`), each tile lists its genres, and the **Genres** filter there and
on Photos in Flight finds photos with or without any.

## On the portfolio

The Timeline, Map and Grid have a **Genre** dropdown in their filters, after **Tag** (`?genre=street`), which shows the
photos that list that genre. Like **Tag**, it's left out while `ALLGENRES.json` is empty. See
[Portfolio Filters](portfolio-filters.md#album-tag-and-genre).

> **Frontend analogy:** a genre is another normalized slice next to albums and tags: the photo keeps an array of IDs,
> and `ALLGENRES.json` is the lookup table that turns them into names, like a `byId` map in a Redux store.
