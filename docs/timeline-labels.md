# Timeline Labels

`/timeline-labels`, under **Configuration** in the sidebar, names runs of days, such as **Korea** for September 20 to
21, 2026 and **Japan** for September 22 to October 2. The portfolio's [Timeline](portfolio-timeline.md) shows each
day's label on the right of the day's heading, which sticks just under the month's heading. So while September 2026's
Japan days scroll past, the top of the list reads **September 2026** with **Japan** under it on the right, and it
switches to **Korea** once the Korea days reach the top.

> **Frontend analogy:** it's a lookup table from a date range to a string, like a `Map<[start, end], label>`, that the
> Timeline checks each day heading against while rendering.

## The file

Each label is one file, `timeline/<id>.json`, and **Commit** combines them into `timeline/TIMELINE.json` the way it
combines the metadata groups into `METAINFO.json`:

```json
{
  "id": "japan-2026-09-22",
  "name": "Japan",
  "start": "2026-09-22",
  "end": "2026-10-02"
}
```

- **`start`** and **`end`** are the first and last days the label covers, both included, written `YYYY-MM-DD`. A
  photo's day is the day of its custom date, or else its EXIF date, as the Timeline groups it.
- Labels can't overlap: saving one whose days another label already covers fails, so each day has at most one label.
  If a hand-edited file does overlap, the Timeline shows both names joined with " · ".
- The ID is the name and first day as an ID, made when the label is first saved and kept when it's renamed or its days
  change.

## The page

The left side lists the labels, newest first, each with its days and how many saved photos were taken on them. The
right side edits the chosen label, or a new one after **New label**: its name, first day and last day (left empty, the
last day is the first). The editor says how many photos fall in the days typed, and says so before saving when another
label already covers some of them.

**Save label** or **Save changes** (`PUT /api/timeline/<id>` → `PUT /timeline/{id}`) and **Remove label**
(`DELETE /api/timeline/<id>` → `DELETE /timeline/{id}`) keep the file as a [change waiting for
Commit](pending-changes.md), counted by the sync button as a timeline label. The page reads the labels from the
[combined data store](combined-data-store.md)'s `TIMELINE.json` with those changes made over it, so a saved label shows
at once. Photos in Flight lists the label files with the others.

Locally, `pnpm photos:local` also makes `TIMELINE.local.json`, which the portfolio uses in place of the committed file.
