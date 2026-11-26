# Tag library

**Tag library** (`components/tag-library/`) overhauls every tag at once with one LLM prompt. Opening it reads every tag and every photo file as the next Commit will have them (`POST /api/data/tag-library/export`, `github/taglibrary_export.go`) and says how many there are, listing any photo file it couldn't read. **Copy the library prompt** (`lib/tag-library-prompt.ts`) copies the whole library as JSON, one line per tag (its parent, description and photo count) and one per photo (its file name without `.json`, title, city and country, places, genres, albums, tags and [photographer notes](../photo-notes.md), leaving out the empty ones, and leaving out its `path` and `id`, which the export has for [Small Tags](../small-tags.md)), with the **Already filtered** names. **Download the library JSON** saves that same JSON as `tag-library.json`, to attach to a chat or look over. The prompt asks for at least 3 photos per tag (`minTagPhotos`), subtags especially, and, whenever a tag is removed or one isn't made because too few photos would have it, a note on each of its photos saying which tag it was, what it described and why it isn't one. The [Small Tags](../small-tags.md) page asks for the same answer, narrowed to the tags with too few photos, and saves with the same request. The answer has Tag pruning's three lists plus five more:

```json
{
  "newTags": [
    {
      "tag": "paper-lanterns",
      "description": "lanterns made of paper",
      "parent": "lanterns",
      "reason": "5 photos show them"
    }
  ],
  "rename": [{ "tag": "lamp", "to": "lamps", "reason": "other tags are plural" }],
  "merge": [],
  "remove": [],
  "reparent": [],
  "describe": [{ "tag": "shotengai", "description": "a covered Japanese shopping street" }],
  "photos": [
    { "photo": "20161216_092741", "add": ["paper-lanterns"], "remove": ["details"], "reason": "…" }
  ],
  "notes": [
    {
      "photo": "20161216_092741",
      "note": "Shows a koi pond; 'koi' isn't a tag, since only 2 photos have one."
    }
  ]
}
```

Paste it and **Review the changes** (`POST /api/data/tag-library/preview`, which saves nothing, `github/taglibrary_answer.go`). The backend reads it as Tag pruning does, and checks every change one at a time in this order, each against the ones before it (`github/taglibrary.go`, whose `tagLibrarian` is Tag pruning's `tagPruner` with new tags in it too): new tags (an ID made from the name, as Bulk tagging makes one, which no album, tag or genre has, under a tag that's kept), renames (a new tag with the old one's description and parent, and the old one merged into it), merges, removals, new parents, descriptions, each photo's tags (a photo found by its file name, with each tag followed to where a merge or rename took it), then notes. A change that can't be made is listed under **Left out** with why.

The review lists each change with a checkbox: new tags, renames (with how many photos), Tag pruning's three lists, descriptions (with the one there now), each photo's tags as **+added** and **−removed** with the tags it had, and the notes. Below them, a box lists every tag that would have fewer than 3 photos once everything listed is made (from the preview's `fewPhotos`, each with the file names of the photos that would have it). **Copy the follow-up prompt** (`tagLibraryFollowUpPrompt` in `lib/tag-library-prompt.ts`) copies those tags and their photos, for the same chat, asking the LLM to add each one to more photos or remove it (or not make it) with a note on each of its photos, and to send its whole answer again. Paste the new answer over the old one and review the changes again. **Save N changes** (`POST /api/data/tag-library`, `{ newTags: [{ id, description, parent }], rename: [{ tag, to }], merge, remove, reparent, describe: [{ tag, description }], photos: [{ path, add, remove }], notes: [{ path, note }] }`, `github/taglibrary_apply.go`) checks them again and saves, in one save of [changes waiting for Commit](../pending-changes.md): each new tag's file (with its parent and description after the changes, unless it was merged away), each merged, renamed or removed tag's file deleted, each kept tag's file with its new `parent` or `description`, and every photo file whose `tags` changed, or that gets a note (added to its `notes` after a blank line). The answer and the save can be up to 4 MB. Nothing is saved when a change can't be made or a photo file can't be read. Unticking a new tag that a photo's change adds makes the save fail and say so.

> **Frontend analogy:** it's Tag pruning grown into a full codemod for the design system: the whole token list and every component's usage go to the LLM, and the diff that comes back can add, rename and delete tokens and update each component, all reviewed as one PR.
