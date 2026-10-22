# Combined data store

`ALLPHOTOS.json`, `ALLALBUMS.json`, `ALLTAGS.json`, `PLACES.json` and `LOCALIZATIONS.json` are read once, on the Settings branch and at the open **Add photo
data** pull request's head (`GET /api/photos/combined` → `GET /photos/combined`), and kept in a Zustand store
(`apps/client-pipeline/src/stores/combined-data.ts`) that every page shares: Photos in Flight, Explore Bucket, the Add
Photo check and the Instagram calendar. Other endpoints don't read them anymore. They only change when you **Commit** them or the
pull request is merged, so the store reads them again only:

- once a **Commit** finishes,
- when Photos in Flight finds another pull request than the one the store read them for, such as after a merge,
- on Photos in Flight's **Refresh**, after the GitHub settings change, and on a page reload.

Saves that push to the pull request (photo JSON, edits, removals, new albums and tags, places and localizations, Update Data, Instagram dates)
mark their mutation with `meta: { pushes: true }`, and give the files they changed as `meta.changes`: the file's path,
its data before and after (`null` when removed). Single-file saves take the data before from the cached Photos in
Flight or Gallery read; Update Data and Instagram dates, which change many files at once, get each file's data before
and after back from the backend (`changes` in their result). The store keeps these changes, and `useCombinedData` returns the lists with them made at the pull
request's head (`data`: the entry equal to the old data replaced, or the new one added), next to the lists as GitHub has
them (`synced`). Pages that read the pull request's lists, such as album pages, show a save at once that way; Photos in
Flight compares its files with `synced`, so it marks the ones that haven't been committed to the lists yet. A **Commit**
drops the changes it took in.

> **Frontend analogy:** it's an optimistic update over a client-side cache: like TanStack Query's `onMutate` writing the
> new value into the cache before the server confirms it, except the "confirmation" is the **Commit** you press by hand.

## Local edits

Some changes don't push at all: they're kept in the browser until **Commit**. The Instagram calendar's dates and Site
Spotlight's zones are kept this way. `stores/local-edits.ts` keeps them in a Zustand store persisted to `localStorage`, each as a photo file's path,
its data as read, and the top-level fields to set. Setting a field back to the file's own value drops it. They're
made over the lists like pushed changes (after them), counted by the sync button, and listed in its panel with a
**Discard** button. **Commit** sends them as `{"edits": [{"path", "fields"}]}`; the backend sets those fields in
each file (only those, so the rest of the file keeps its formatting), builds the combined lists from the edited files
and commits both together. With no pull request open, that commit goes on a new `photo-data/` branch and opens one.
Edits made while a commit runs are kept for the next one.

## Committing the combined files

Saves don't touch the combined files. **Commit** (`POST /api/photos/combined` →
`POST /photos/combined`) saves any [local edits](#local-edits), then builds all five (`ALLPHOTOS.json`, `ALLALBUMS.json`, `ALLTAGS.json`, `PLACES.json` and `LOCALIZATIONS.json`) on the open **Add photo data** pull request's branch and commits the ones that
changed as one commit, "Combine photo, album and tag data". Each is every other `.json` file directly in its folder,
sorted by path, as one array, formatted as oxfmt formats it, so a list that's already up to date isn't committed again.
When a file can't be read or isn't valid JSON, nothing is committed and the error names it. The backend does this
itself with the contents and Git data APIs, so nothing waits for a CI runner.

Whether the files are synced is checked once, when the app starts (`GET /api/photos/combined/status` →
`GET /photos/combined/status`): `stale` when the newest commit on the pull request's branch to change the data folder
isn't a Commit, `synced` when it is, and `none` with no pull request open. When `stale`, it also lists `pending`: the
data files GitHub's compare shows changed between the last Commit (among the branch's last 100 commits to the data
folder, or else the base branch) and the head, each with its kind and whether it was added, modified or deleted. The
sync button counts those together with the app's own saves since, each file once, so saves made before a reload are
still counted. After that it's known from the app's own saves and commits; nothing polls in between.

> **Frontend analogy:** it's hydrating a client cache from the server on load. The store's own list of saves lives in
> memory, like React state, and a reload empties it; the status call refills it with what the server already has.

A floating button at the top right of every page shows where things stand: **Synced · batch open** (everything is committed, but the photo data pull request, the batch, still waits to be merged), **Synced · no open batch**, **Not synced · 3 images** (every image added, modified or deleted since the last commit, each counted once, with albums, tags, places and localizations after them; the panel shows the images as three counts, Added, Modified and Deleted, and a file added and then deleted again doesn't count),
**Committing…** or **Commit failed**. Clicking it opens a panel with the pull request, the counts, the last commit's link,
**Discard** for local edits, and **Commit**. Photos in Flight also says so in its **Synced** row, with the
same button, and marks each file that isn't in the combined files with "Not synced to ALLPHOTOS.json yet". The lines
that follow a save elsewhere, such as on the Photo page, link back to Photos in Flight to commit.

The **Combine photo data** workflow (`.github/workflows/combine-photo-data.yml`) does the same build with the same
commit message, but only when started by hand from the Actions tab (`workflow_dispatch`), never on a push or on the
default branch. It's there as a fallback, for when the app isn't running.

> **Frontend analogy:** it's like a "Save" button in an editor instead of autosave on every keystroke: you batch up
> changes, see them right away (the optimistic store), and write them out in one go. The floating button is the
> "unsaved changes" dot in the tab title.
