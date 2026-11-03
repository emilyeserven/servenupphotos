# Small Tags

**Small Tags** (`/small-tags`, under **Organize** in the sidebar, `components/small-tags/`) lists every tag and subtag
that fewer than 3 photos show (`minTagPhotos`, the same rule as the [Tag library](update-data.md#tag-library)), so
they can be cleaned up. A tag's count is what filtering by it shows: the photos that have it or any tag under it, so a
parent whose own photos are few but whose subtags have plenty isn't listed. The fewest come first.

It reads the same data as the Tag library (`POST /api/data/tag-library/export`): every tag and readable photo file as
the next Commit will have them, changes waiting for Commit included. Each photo there has its file's `path`, which a
save names it by, and its `id`, which finds its Square Thumbnail in `ALLPHOTOS.json` (`usePhotosById`). A photo not in
`ALLPHOTOS.json` yet shows its name without an image. `lib/small-tags.ts` works out the list (`smallTags`).

> **Frontend analogy:** it's a derived view, like a `useMemo` that filters a list: no endpoint of its own, just the
> Tag library's export filtered on the client, with the Tag library's save as the only mutation.

## Each tag

A card shows the tag's ID, its count, its parent (or top level), the tags under it and its description, then the
photos that have it themselves (each opening full size), and three actions, one open at a time:

- **Remove** deletes the tag's file and takes it off every photo. A note box, prefilled with which tag it was, its
  description and why it went (`removalNote`), adds a [photographer note](photo-notes.md) to each of its photos, after
  any notes they have; emptying it adds none. The tags under it go under its parent.
- **Rename or merge** takes a tag ID, suggesting the other tags as it's typed (lowercased, spaces as dashes). Another
  tag's ID merges it into that tag: every photo with it gets that tag instead, and the tags under it go under that
  tag. An ID no tag has renames it, keeping its photos, description and the tags under it.
- **Add to more photos** lists the photos without it, those sharing the most tags with its photos (or having its
  parent) first, 30 at a time, with a search over file name, title, place and tags. Ticking photos and **Add tag to N
  photos** adds it to them.

Each one saves with the Tag library's save (`POST /api/data/tag-library`, `github/taglibrary_apply.go`) holding just
that change, as [changes waiting for Commit](pending-changes.md). The list is read again after a save, so a tag that's
gone, or has enough photos now, drops off. The last save's result shows above the list, and a save that fails says why
on its tag's card. **Find a tag or its parent** narrows the list.

## Asking an LLM

**Copy the prompt for N small tags** (`smallTagsPrompt`) copies the Tag library's prompt, with the whole library for
context, then lists each small tag with its parent, count and the photos that have it (by file name), asking the LLM
to only fix those: add each to more photos, merge or rename it, or remove it with a note on each of its photos, and
leave the rest alone. Its answer is the Tag library's JSON, so pasting it into the box below and **Review the
changes** shows the Tag library's review (`components/tag-library/library-answer.tsx`, shared with Update Data), where
each change can be unticked before it's saved.
