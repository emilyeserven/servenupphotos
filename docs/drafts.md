# Drafts

A photo without a title (a `title` that's missing, `null` or only spaces) is a **draft**. Its JSON file is saved and
committed like any other, but **Commit** leaves it out of `ALLPHOTOS.json`, so the portfolio, which only reads
`ALLPHOTOS.json`, doesn't show it. Giving it a title on the Photo page and committing puts it in `ALLPHOTOS.json`, and
the portfolio shows it once the pull request merges. Taking a title away makes it a draft again, and the next Commit
takes its entry out. Photos from [Bulk Upload](bulk-upload.md) start without a title, so they're drafts until they're
named.

> **Frontend analogy:** it's like a CMS post with `published: false`. The post is saved in the database, but the
> public site's query filters it out. Here the "query" is the step that builds `ALLPHOTOS.json`, and the filter is
> "has a title".

## The setting

**Settings → GitHub → Keep untitled photos as drafts** is on by default. Turned off, every photo goes in
`ALLPHOTOS.json`, and the portfolio names an untitled one by its file name, as it did before drafts. It's saved as the
GitHub settings' `includeUntitled` (`false` by default) and changes what the next Commit builds; Commit only rebuilds
`ALLPHOTOS.json` when something is waiting or a photo data pull request is open.

## Where drafts show

- **Photos in Flight** can set an untitled photo aside in its [Undecided](photos-in-flight.md#undecided) queue.
- **Photos in Flight** marks a draft **Draft, not on the portfolio** instead of the `ALLPHOTOS.json` check mark, and the
  sync button's panel counts it as synced, since `ALLPHOTOS.json` isn't missing anything.
- **Gallery** lists drafts on the base branch too (it reads the photos folder, not `ALLPHOTOS.json`), marked **Draft**.
- **Site Spotlight** and the **Instagram calendar** list drafts with a **Draft** label. A draft can be put in a
  spotlight zone or scheduled, but the portfolio's spotlight skips it until it has a title. The calendar's count of
  photos in flight leaves drafts out and counts them on their own.
- The **Photo page**'s Title hint says the photo stays a draft without one.
- The **already saved** check (`POST /api/photos/all-photos/check`) also looks at the drafts on the base branch, since pages only
  check `ALLPHOTOS.json` there, which doesn't list them.

## IDs and links

A draft gets its photo ID when its file is made, like any photo, and keeps it. A shareable link such as `/grid?photo=12`
to a draft opens nothing until it has a title and is merged, and then opens it with the same ID.

## Outside the pipeline

- The **Combine photo data** workflow leaves drafts out too, unless it's started with **include_untitled** checked.
- `pnpm photos:local` follows the pipeline's setting when the pipeline is running, and otherwise leaves drafts out of
  the local `ALLPHOTOS.local.json` it builds from the data folders.

The rule lives in `isDraft` (`apps/be-pipeline/internal/github/drafts.go`) and `isDraft`
(`apps/client-pipeline/src/lib/drafts.ts`), which the workflow's `jq` filter and the local script match.
