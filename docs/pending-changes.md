# Changes waiting for Commit

Nothing the pipeline saves goes to GitHub on its own. Saving a photo (Photo page, Bulk Upload, Explore Bucket), editing
or removing one (Photos in Flight, Gallery), making an album or tag or moving an album, saving a place or localization,
adding albums and tags to photos from the Gallery, Update Data and Instagram dates all keep their files in the app as
**changes waiting for Commit**. The only button that writes photo data to GitHub is **Commit**, on Photos in Flight and
in the sync button's panel at the top right. Uploads to R2 still happen right away, since the JSON points at them.

> **Frontend analogy:** it's a form with a single Submit. Each save is like typing into a field: the page shows the new
> value at once (the [combined data store](combined-data-store.md) makes it over the lists), but nothing goes over the
> network until you press Submit, and then everything goes in one request.

## Where they're kept

The Go backend keeps them in `pending-changes.json` next to the settings file (in the settings folder, `0600`), keyed
by repository, each as a data file's path and its new content, or a deletion. They survive a reload and a restart of
the pipeline. Every read the backend makes (Photos in Flight, the Gallery, Albums and Tags, Places, Update Data, the
Instagram calendar, the duplicate check) sees the files **as the next Commit will have them**: the open **Add photo
data** pull request's head, or the Settings branch when none is open, with the changes laid over it. So a name
collision, a parent album or a place's name is checked against your unsaved work too.

Saving a file with the same content it already has at the head drops its change, so saving something back the way it
was leaves nothing waiting. Removing a photo that's only waiting for Commit just drops it; removing one committed to
the pull request waits for Commit like any other change. Photos already in the portfolio can't be removed here.

The app shows them as they're saved, and after a reload gets them back from `GET /api/photos/combined/status`
(`changes`: each file's kind, path, its data at the head and as saved). Photos in Flight marks each one **Waiting for
Commit**, without a GitHub link until it's committed, and with no pull request open it says how many files are
waiting and that Commit opens one. The sync button counts them with the rest.

**Discard**, in the sync button's panel, drops every change waiting for Commit and the browser-only edits, after
asking (`DELETE /api/photos/pending`, body `{}` for all or `{"paths": [...]}`). GitHub and R2 aren't touched, so
uploaded images stay in R2 for Explore Bucket.

> **Frontend analogy:** the backend is the source of truth, like a server-side draft in a CMS. The app's store is a
> cache of it (an optimistic one), refilled from the status call on load, the same way TanStack Query hydrates from a
> loader.

## Commit

**Commit** (`POST /api/photos/combined`) writes, as **one commit**, every change waiting for Commit, the browser-only
[local edits](combined-data-store.md#local-edits), and `ALLPHOTOS.json`, `ALLALBUMS.json`, `ALLTAGS.json`,
`PLACES.json` and `LOCALIZATIONS.json` rebuilt from the result. It uses GitHub's
[Git database API](https://docs.github.com/en/rest/git/trees#create-a-tree): one tree with every changed file (a
deletion is an entry with `sha: null`), one commit on top of the pull request's head, and the branch moved to it. With
no pull request open it creates a `photo-data/<date>-<time>` branch at that commit from the Settings branch and opens
the **Add photo data** pull request. Before committing it asks GitHub where the branch is now, so a push made on GitHub
in the meantime isn't overwritten; when the branch moves while it commits, GitHub refuses the move and nothing is lost:
the changes stay waiting, and Commit can be pressed again. Once committed, the changes it had are dropped (ones saved
while it ran stay for the next one).

> **ELI5:** instead of mailing one letter per change, the app keeps every letter in a drawer and, when you press
> Commit, puts them all in one envelope.

## GitHub calls

GitHub allows 5,000 REST requests an hour and a separate 5,000 points an hour for GraphQL for a token
([REST limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
[GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api)).
The backend spends them like this:

| When                                        | Calls                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any read, at most every 30 seconds          | 1 GraphQL query: the repository, the Settings branch's head and the open pull requests. Pages loading together share it                                                               |
| A commit not read before                    | 1 GraphQL query: every file in the five data folders with its content. Commits never change, so each is read once; the Settings branch and the pull request's head are kept in memory |
| A file too big for GraphQL to return inline | 1 REST read of that file (`GET /git/blobs/<sha>`), such as a large `ALLPHOTOS.json`                                                                                                   |
| Saves, edits, removals, Discard             | None, beyond the reads above when they're stale                                                                                                                                       |
| **Commit**                                  | 1 GraphQL query for the latest heads, then 3 REST writes (tree, commit, branch move), plus 2 (branch, pull request) when it opens the pull request                                    |
| Settings' **Test** button                   | 1 REST read of the repository, as before                                                                                                                                              |

**Refresh** on Photos in Flight sends `?refresh=1`, which drops the 30-second state so a merge or a push made on
GitHub shows right away.

When GitHub says the limit is spent (HTTP 403 or 429 with `X-RateLimit-Remaining: 0` or `Retry-After`, or GraphQL's
`RATE_LIMITED`), every endpoint answers 429 with "GitHub's rate limit was hit, so nothing was read or saved. Try again
in 20 minutes (03:05 UTC); your changes are kept until then." The time comes from `X-RateLimit-Reset` or
`Retry-After`.

> **Frontend analogy:** the 30-second state is a `staleTime` for "where is the repository now", and the per-commit
> snapshot is an immutable cache keyed by content hash, like a hashed asset filename that never needs revalidating.

The token still needs **Contents: Read and write** and **Pull requests: Read and write**; fine-grained tokens can use
GraphQL with those ([changelog](https://github.blog/changelog/2023-04-27-graphql-improvements-for-fine-grained-pats-and-github-apps)).
