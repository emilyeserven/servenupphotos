# Changelog

The **Changelog** page (`/changelog`, under **Configuration › Settings** in the sidebar) lists what changed in the
pipeline and the portfolio, newest first, grouped by the day each change landed. It's read from the commits on the
base branch of the repository in Settings (the default branch when Settings names none), so it needs only the GitHub
token the pipeline already has.

## What each change shows

Every pull request here is squash-merged, so each commit on the base branch is one merged pull request, titled with the
pull request's title and GitHub's ` (#434)` at the end. For each one the page shows:

- the title, without the ` (#434)`;
- a link to the pull request (**#434**), when the title names one;
- a link to the commit, by its short ID;
- who wrote it (their GitHub login, or the commit's author name) and the time it landed.

Above the days, `owner/name · branch` links to the branch's commits on GitHub.

## What's left out

- **Merge commits:** any commit with two parents or more, or titled like a merge (`Merge branch …`,
  `Merge remote-tracking branch …`, `Merge pull request …`), such as merging `main` into a branch. They say nothing
  about the change.
- **Photo data merges:** merged **Add photo data** pull requests change the photos, not the code, so they're hidden
  until **Show photo data merges** is ticked.

## Loading

The backend reads 100 commits at a time from GitHub's
[list commits endpoint](https://docs.github.com/en/rest/commits/commits#list-commits) (`GET /api/changelog?page=1`).
When GitHub has older ones, **Load older changes** at the bottom reads the next 100. The page keeps what it read for 5
minutes, since the branch only changes when a pull request is merged.

> **Frontend analogy:** it's a `useInfiniteQuery` over a paginated REST list. The Go backend is the `fetch` wrapper
> that adds the token header and trims each GitHub commit down to the few fields the page renders, like a `select`
> that runs on the server, so the token never reaches the browser.

The code is `internal/github/changelog.go` (reading and filtering) and `internal/httpapi/changelog.go` in the backend,
and `api/changelog.ts`, `routes/changelog.tsx` and `components/changelog/` in the client. `pnpm shot` answers
`/api/changelog` from the checkout's own `git log`.
