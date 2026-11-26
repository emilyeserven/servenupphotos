# Tag pruning

**Tag pruning** asks an LLM which tags to tidy up. **Copy the pruning prompt** (`lib/prune-tag-prompt.ts`) copies every tag as a tree, each under its [parent](../albums-and-tags.md#parent-tags), with how many photos in `ALLPHOTOS.json` have it and its description, then the **Already filtered** names (albums, genres and metadata groups, as the [tag prompt](../albums-and-tags.md#suggest-tags) lists them). It asks for three kinds of change, conservatively and with a short reason each, using only the listed tags:

- **Merge** a tag into another that means the same or nearly so (a singular and a plural, a synonym, another spelling). A culture's own word is put under a general tag instead of merged into it.
- **Remove** a tag that doesn't help find photos: too vague, naming a specific place or thing, or repeating what the site already filters by. Having only one photo isn't a reason on its own.
- **Reparent** a tag under a more general one it's a kind of, or move it to the top level (`"parent": null`).

It asks for at least 3 photos per tag, subtags especially, and to remove or merge a tag with fewer. For the notes, the prompt also lists each photo with a tag that fewer than 3 photos have (by file name, from the Tag library's read, `fewPhotoTagLines`), and asks for a note on each photo of a tag it removes for that: which tag it was, what it described and why it isn't a tag, under `"notes": [{ "photo", "note" }]`, which go into the photos' [photographer notes](../photo-notes.md).

```json
{
  "merge": [{ "tag": "lamppost", "into": "lamps", "reason": "a kind of lamp" }],
  "remove": [{ "tag": "details", "reason": "too vague" }],
  "reparent": [{ "tag": "torii", "parent": "shrine", "reason": "a shrine gate" }],
  "notes": [
    {
      "photo": "20161216_092741",
      "note": "Shows a torii gate; 'torii' isn't a tag, since only 1 photo has one."
    }
  ]
}
```

Paste the answer and **Review the changes** (`POST /api/data/prune-tags/preview` with `{ answer }`, which saves nothing). The backend reads the JSON object in it as Bulk tagging does, matches each name to a tag by its ID or name (ignoring case, or by the ID made from it), and checks the changes one at a time, merges first, then removals, then new parents, each against the ones before it (`github/prunetags.go`). A change that can't be made is listed under **Left out** with why: a name that isn't a tag, a tag already merged or removed, removing a tag another is merged into, a tag that's already under that parent, or a change that would put a tag inside itself. Merging into a tag that is itself merged later follows it there.

The review lists each change with a checkbox, the LLM's reason, and what it does: how many photo files a merge or removal touches and which tags under it move, or where a tag sits now. **Save N changes** (`POST /api/data/prune-tags`, `{ merge: [{ tag, into }], remove: [ids], reparent: [{ tag, parent }], notes: [{ path, note }] }`) checks them again and saves, in one save of [changes waiting for Commit](../pending-changes.md):

- each merged or removed tag's file deleted;
- every photo file listing one rewritten with only its `tags` changed: a merged tag replaced by the tag it went into (kept once, where the first of them was), a removed one taken off;
- the tags under a merged tag moved under the tag it went into, the ones under a removed tag under that tag's parent, and each reparented tag's `parent` set (`null` at the top level);
- each ticked note added to its photo's `notes`. The notes are listed in the review with a checkbox each, and a note for a photo file that isn't there is left out saying so.

Nothing is saved when a change can't be made or a photo file can't be read, since it might list a pruned tag.

> **Frontend analogy:** it's a refactor of a design system's tokens: rename two tokens that mean the same into one, delete unused ones, and regroup the rest, with a dry-run diff that rewrites every component using them on save.
