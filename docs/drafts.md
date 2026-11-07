# Drafts

A photo without a title (a `title` that's missing, `null` or only spaces) is a **draft**, and so is one set aside as
[Undecided](photos-in-flight.md#undecided) (`undecided: true`), whatever its title: that's how a photo with a title is
unpublished. Its JSON file is saved and
committed like any other, but **Commit** leaves it out of `ALLPHOTOS.json`, so the portfolio, which only reads
`ALLPHOTOS.json`, doesn't show it. Giving it a title on the Photo page and committing puts it in `ALLPHOTOS.json`, and
the portfolio shows it once the pull request merges. Taking a title away, or setting a titled photo aside as
Undecided, makes it a draft again, and the next Commit takes its entry out. Moving it back from Undecided puts it in
again. Photos from [Bulk Upload](bulk-upload.md) start without a title, so they're drafts until they're
named.

> **Frontend analogy:** it's like a CMS post with `published: false`. The post is saved in the database, but the
> public site's query filters it out. Here the "query" is the step that builds `ALLPHOTOS.json`, and the filter is
> "has a title".

The save that gives a draft its title (or the Commit that moves a titled photo back from Undecided) also sets its
`addedDate` to that moment, unless it already has one (see
[Date added](data-model.md#date-added)), which the portfolio's **Recently Added** sort uses. A draft that has never been on
the portfolio has a `null` `addedDate`.

## The setting

**Settings → GitHub → Keep untitled photos as drafts** is on by default. Turned off, every photo goes in
`ALLPHOTOS.json`, and the portfolio names an untitled one by its file name, as it did before drafts. It's saved as the
GitHub settings' `includeUntitled` (`false` by default) and changes what the next Commit builds; Commit only rebuilds
`ALLPHOTOS.json` when something is waiting or a photo data pull request is open.

## Where drafts show

- **Photos in Flight** can set any photo aside in its [Undecided](photos-in-flight.md#undecided) queue, titled or not.
- **Photos in Flight** marks a draft **Draft, not on the portfolio** instead of the `ALLPHOTOS.json` check mark, and the
  sync button's panel counts it as synced, since `ALLPHOTOS.json` isn't missing anything.
- **All Photos** can show drafts and Undecided photos among the published ones, where they'd go, and each draft
  elsewhere has **See in All Photos** to open it there (see [All Photos](all-photos.md)).
- **Gallery** lists drafts on the base branch too (it reads the photos folder, not `ALLPHOTOS.json`), marked **Draft**.
- The **Instagram calendar** lists drafts with a **Draft** label. A draft can be scheduled, and can be in an album
  a spotlight zone shows, but the portfolio skips it until it has a title. The calendar's count of
  photos in flight leaves drafts out and counts them on their own.
- The **Photo page**'s Title hint says the photo stays a draft without one.
- The **already saved** check (`POST /api/photos/all-photos/check`) also looks at the drafts on the base branch, since pages only
  check `ALLPHOTOS.json` there, which doesn't list them.

## IDs and links

A draft gets its photo ID when its file is made, like any photo, and keeps it. A shareable link such as `/grid?photo=12`
to a draft opens nothing until it has a title and is merged, and then opens it with the same ID.

## Outside the pipeline

- The **Combine photo data** workflow leaves drafts (untitled or Undecided) out too, unless it's started with **include_untitled** checked.
- `pnpm photos:local` follows the pipeline's setting when the pipeline is running, and otherwise leaves drafts out of
  the local `ALLPHOTOS.local.json` it builds from the data folders.

An [unselected photo](compare-groups.md#off-the-portfolio) is left out of `ALLPHOTOS.json` too, whatever this setting
says, and so is a [casual photo](trip-lines.md#casual-photos) (`"casual": true`), which shows only with its place on a
Trip page (`isCasual`).

The rule lives in `isDraft` (`apps/be-pipeline/internal/github/drafts.go`) and `isDraft`
(`apps/client-pipeline/src/lib/drafts.ts`), which the workflow's `jq` filter and the local script match.
