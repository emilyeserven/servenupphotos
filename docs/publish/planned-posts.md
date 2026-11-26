# Planned Posts

`/instagram-planned`, under **Instagram** in the sidebar, goes through the photos still to put on Instagram one at a time, made to sit in a narrow window next to Instagram. A photo is planned when it has an Instagram post with status **Planned**, or is on the Instagram calendar without an Instagram post that's **Scheduled**. They come in the order they go up: by the planned post's day, or else the calendar day, with photos without a day last; a day before today is marked **Overdue**. Photos set aside as Undecided are left out, as on the calendar. The list is worked out in the browser from the photo files the calendar reads, with changes waiting for Commit and local edits made over them (`plannedPhotos` in `apps/client-pipeline/src/lib/instagram-planned.ts`).

Each photo shows its Medium version, its name (a link to edit it), its day, and:

- **Download original JPEG**, which saves the original from R2, named after the photo's `file`. A browser won't download straight from R2's address on another origin, so the link goes through the pipeline: `GET /api/photos/original?key=<images.key>&name=<file>` reads the original from R2 and sends it as an attachment.
- **Caption**, the default Instagram [caption template](../caption-templates.md) (the first one for Instagram, or else the first for any platform, as the Photo page's Generate starts with) filled in from the photo and its planned post's hashtags, with **Copy caption**. A caption already written on the planned post is shown instead.
- **Mark as Scheduled and go to the next**, which sets the planned Instagram post's status to scheduled (keeping its caption, or else taking the one shown, and the calendar day when it has none), or adds a scheduled Instagram post with the caption on the calendar day when the photo had none. The photo leaves the list, so the next one shows in its place, and **Undo** above it puts its posts back. Like the calendar, it's a [local edit](../combined-data-store.md#local-edits) of the photo's `socialPosts`, so nothing goes to GitHub until **Commit**.

**Previous** and **Next** move through the list without changing anything.

> **Frontend analogy:** it's a wizard over a derived list: the steps are a `useMemo` filter of the store, and finishing a step edits the store so the item filters itself out, the way a todo app's "done" button shrinks an "active" view.
