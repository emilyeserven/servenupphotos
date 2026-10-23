# Gallery

`/gallery` shows the photos already in the portfolio: every photo `.json` on the base branch (`GET /api/photos/published`
→ `GET /photos/published`), newest first, as Square Thumbnail tiles with their title and file name, filterable by
either. Photos the open **Add photo data** pull request changes are marked "Changes in flight" (or "Removed in flight"),
linked to Photos in Flight. A photo with no title on the base branch is a [draft](drafts.md), listed here but marked
**Draft**, since `ALLPHOTOS.json` leaves it out. The list is read from the photos folder rather than `ALLPHOTOS.json`, since editing needs
each photo's file path, which `ALLPHOTOS.json` entries don't carry.

Each photo with its image in R2 has an **Edit** button that opens it on the Photo page (`/exif?edit=<path>&from=gallery`),
the same editor Photos in Flight uses, and each tile lists the photo's album and tag names. Saving keeps the JSON as a
[change waiting for Commit](pending-changes.md), which Commit sends to the open pull request (the branch must already
have the file; update it from the base branch if it was made before the photo merged), or to a new one when none is
open. From then on the photo is in Photos in Flight, and edits go to that copy. A new title doesn't rename the file, since the pull request would then delete
the old file from the portfolio when it merges and the photo's file name would change under it.

**Select** turns on choosing photos, with a checkbox on each tile (or click the tile), **Select all shown** for the
filtered ones, and an **Add albums and tags** card with an album and a tag combobox. **Add to N photos**
(`POST /api/photos/groups` with `paths`, `albums` and `tags`) adds them to each chosen photo's `albums` and `tags`
after the ones it has, changing nothing else in the files, as [changes waiting for Commit](pending-changes.md), the
way Update Data saves. It warns when a chosen photo is already in another album.
