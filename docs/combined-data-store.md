# Combined data store

`ALLPHOTOS.json`, `ALLALBUMS.json`, `ALLTAGS.json`, `PLACES.json`, `LOCALIZATIONS.json`, `METAINFO.json`, `CAMERAS.json` and `LENSES.json` are read once, on the Settings branch and at the open **Add photo
data** pull request's head (`GET /api/photos/combined` → `GET /photos/combined`), and kept in a Zustand store
(`apps/client-pipeline/src/stores/combined-data.ts`) that every page shares: Photos in Flight, Explore Bucket, the Add
Photo check and the Instagram calendar. Other endpoints don't read them anymore. They only change when you **Commit** them or the
pull request is merged, so the store reads them again only:

- once a **Commit** finishes,
- when Photos in Flight finds another pull request than the one the store read them for, such as after a merge,
- on Photos in Flight's **Refresh**, after the GitHub settings change, and on a page reload.

Saves (photo JSON, edits, removals, new albums and tags, moved albums, places, localizations, metadata groups, camera overrides and custom lenses, albums and tags added
from the Gallery, Update Data) become [changes waiting for Commit](pending-changes.md), kept by the backend. Their
mutations are marked `meta: { saves: true }` and give the files they changed as `meta.changes`: the file's path, its
data before and after (`null` when removed). New files take theirs from the result's `data`; edits and removals get
the data before back from the backend (`before`), and bulk saves get each file's data before and after (`changes`). The
store keeps these changes, and `useCombinedData` returns the lists with them made at the pull request's head (`data`:
the entry equal to the old data replaced, or the new one added; with no pull request open, over the base branch's
lists, as the head Commit will open), next to the lists as GitHub has them (`synced`). Pages that read the pull request's lists, such as album pages, show a save at once that way; Photos in
Flight compares its files with `synced`, so it marks the ones that haven't been committed to the lists yet. A **Commit**
drops the changes it took in.

> **Frontend analogy:** it's an optimistic update over a client-side cache: like TanStack Query's `onMutate` writing the
> new value into the cache before the server confirms it, except the "confirmation" is the **Commit** you press by hand.

## Local edits

Some changes aren't even kept by the backend: they're kept in the browser until **Commit**. The Instagram calendar's dates and the Photo
page's spotlight focus point are kept this way. `stores/local-edits.ts` keeps them in a Zustand store persisted to `localStorage`, each as a photo file's path,
its data as read, and the top-level fields to set. Setting a field back to the file's own value drops it. They're
made over the lists like saved changes (after them), counted by the sync button, and dropped with the rest by its
panel's **Discard**. **Commit** sends them as `{"edits": [{"path", "fields"}]}`; the backend sets those fields in
each file (only those, so the rest of the file keeps its data), builds the combined lists from the edited files
and commits them with everything else waiting. With no pull request open, that commit goes on a new `photo-data/` branch and opens one.
Edits made while a commit runs are kept for the next one. A save that renames the file (a new title renames a photo that isn't in the portfolio
yet) moves its edits to the new name (the mutation's `meta.moves`), so a focus point set before the save still lands on
the photo. An edit of a file that isn't on GitHub anymore is left out and shown
after the commit instead of failing it (see [pending changes](pending-changes.md#commit)).

## Committing the combined files

Saves don't touch GitHub or the combined files. **Commit** (`POST /api/photos/combined` →
`POST /photos/combined`) takes every [change waiting for Commit](pending-changes.md) and any [local edits](#local-edits), builds all eight (`ALLPHOTOS.json`, `ALLALBUMS.json`, `ALLTAGS.json`, `PLACES.json`, `LOCALIZATIONS.json`, `METAINFO.json`, `CAMERAS.json` and `LENSES.json`) from the result and commits
everything that changed as one commit, "Combine photo, album and tag data", on the open **Add photo data** pull
request's branch, or on a new `photo-data/` branch with a new pull request when none is open. Each is every other `.json` file directly in its folder,
sorted by path, as one array, formatted as oxfmt formats it, so a list that's already up to date isn't committed again.
Every data file in the commit is formatted the same way first (a short list such as `"spotlightZones": ["homepage"]` on one
line), so CI's `oxfmt --check` passes on what the app commits.

> **Frontend analogy:** like running Prettier on save, except the backend is the one saving, so it formats the files itself.

When the pull request's branch is behind the base branch (another pull request merged since it was opened), the
commit also merges the base branch in: it's made from the base branch's files with the pull request's own data files
over them, and the combined lists rebuilt from that, so the pull request never conflicts over a combined list. When
both changed the same data file, the pull request's version is kept. Commit does this even when nothing else is
waiting, so pressing it fixes a pull request that has fallen behind. A file only the pull request added and since
removed is simply left out of that merge, since the base branch never had it (GitHub refuses a commit that deletes a file
that isn't there with a 422).

> **Frontend analogy:** like a lockfile conflict you fix by reinstalling rather than merging by hand: the combined
> lists are generated, so the merge regenerates them instead of merging their text.

When a file can't be read or isn't valid JSON, nothing is committed and the error names it. When GitHub refuses one of
Commit's calls, the error says which step it was and GitHub's message, and the In Flight page and the sync panel show
GitHub's whole answer under it: the step, the request (such as `POST …/git/trees`), the status, GitHub's message, its
`errors` list, the docs page it points to and its request ID, with a copyable JSON block. Every page's GitHub errors
carry the same answer (`github` in the error body), and the backend logs it.

> **Frontend analogy:** it's the Network tab's entry for the failed request, shown on the page instead of being boiled
> down to "something went wrong". The backend does this
> itself with GitHub's Git database API, so nothing waits for a CI runner.

Whether the files are synced is checked once, when the app starts (`GET /api/photos/combined/status` →
`GET /photos/combined/status`), without asking GitHub anything new: the backend compares each combined list at the
pull request's head with the data files it's built from, from the same read as everything else. It's `stale` when
changes are waiting for Commit or a data file isn't in its list (as after a push made on GitHub), `synced` when every
one is, and `none` with no pull request open and nothing waiting. It lists `pending`, each such file with its kind and
whether it was added, modified or deleted, and `changes`, the changes waiting for Commit with their data at the head
and as saved, which the store makes over the lists again after a reload. The sync button counts those together with
the app's own saves since, each file once. After that it's known from the app's own saves and commits; nothing polls in
between.

> **Frontend analogy:** it's hydrating a client cache from the server on load. The store's own list of saves lives in
> memory, like React state, and a reload empties it; the status call refills it with what the server already has.

A floating button at the top right of every page shows where things stand: **Synced · batch open** (everything is committed, but the photo data pull request, the batch, still waits to be merged), **Synced · no open batch**, **Not synced · 3 images** (every image added, modified or deleted since the last commit, each counted once, with albums, tags, places, localizations, metadata groups, camera overrides and custom lenses after them; the panel shows the images as three counts, Added, Modified and Deleted, and a file added and then deleted again doesn't count),
**Committing…** or **Commit failed**. Clicking it opens a panel with the pull request, the counts, the last commit's link,
**Discard** for everything waiting for Commit, and **Commit**. While a photo in flight has no title, the panel also has
**Next untitled photo**, with how many there are (leaving out the [Undecided](photos-in-flight.md#undecided) ones), which opens the next one on the Photo page (`/exif?edit=<path>`):
the first after the photo open there, in Photos in Flight's order, going back to the first after the last. Photos in Flight also says so in its **Synced** row, with the
same button, and marks each file that isn't in the combined files with "Not synced to ALLPHOTOS.json yet". The lines
that follow a save elsewhere, such as on the Photo page, link back to Photos in Flight to commit.

The **Combine photo data** workflow (`.github/workflows/combine-photo-data.yml`) does the same build with the same
commit message, but only when started by hand from the Actions tab (`workflow_dispatch`), never on a push or on the
default branch. It's there as a fallback, for when the app isn't running.

> **Frontend analogy:** it's like a "Save" button in an editor instead of autosave on every keystroke: you batch up
> changes, see them right away (the optimistic store), and write them out in one go. The floating button is the
> "unsaved changes" dot in the tab title.
