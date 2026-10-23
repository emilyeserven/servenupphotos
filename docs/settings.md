# Settings

Open `/settings` in the pipeline UI to enter the Cloudflare R2 and GitHub settings the pipeline uses. The Go backend saves them to `SETTINGS_FILE`: `apps/be-pipeline/data/settings.json` (git-ignored) with
`pnpm dev:be`, or `/data/settings.json` on the `pipeline-data` Docker volume. The file is readable only by its owner.

The R2 secret access key and the GitHub token are **write-only**: `GET /settings` reports only whether each is set and
its last four characters, so after saving you can replace or clear a secret but never read it back. In a
`PUT /settings/{r2,github}` body, leaving the secret out keeps it, `""` clears it, and any other value replaces it.

> **Frontend analogy:** it works like the "Change password" field on an account page. You can set a new password, but
> the site never shows you the current one. The real value exists only on the backend.

The GitHub card also has **Keep untitled photos as drafts**, on by default, saved as `includeUntitled: false`; leaving
`includeUntitled` out of a `PUT /settings/github` body keeps it. See [Drafts](drafts.md).
