# Combined data store

`ALLPHOTOS.json`, `ALLALBUMS.json` and `ALLTAGS.json` are read once, on the Settings branch and at the open **Add photo
data** pull request's head (`GET /api/photos/combined` → `GET /photos/combined`), and kept in a Zustand store
(`apps/client-pipeline/src/stores/combined-data.ts`) that every page shares: Photos in Flight, Explore Bucket, the Add
Photo check and the Instagram calendar. Other endpoints don't read them anymore. They only change when CI rebuilds them
or the pull request is merged, so the store reads them again only:

- after a save that pushes to the pull request (photo JSON, edits, removals, new albums and tags, Update Data, Instagram
  dates; each marks its mutation with `meta: { pushes: true }`), once the **Combine photo data** run for it finishes
  (or about 30 seconds later without **Actions: Read-only**),
- when Photos in Flight finds the pull request at a head the store didn't read them at, such as after a merge or a push
  from elsewhere,
- on Photos in Flight's **Refresh**, after the GitHub settings change, and on a page reload.

> **Frontend analogy:** it's a client-side cache with manual invalidation, like a TanStack Query entry with
> `staleTime: Infinity` whose only `invalidateQueries` calls are tied to "CI finished" events.
