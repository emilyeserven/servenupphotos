# Trip Pages

A Trip page tells the story of a trip on the portfolio, under **Albums**: each day's photos in rows, a caption under a
photo, and paragraphs between photos. It's written day by day on the pipeline's [Trip Lines](trip-lines.md) page and
built by **Commit**.

> **Frontend analogy:** each day's story is like a CMS block list for one section of a page (the same idea as an
> album's [layout](album-layouts.md)), and Commit is a static site build that stitches the sections of one Trip into
> one page's JSON, so the portfolio only renders it.

## Writing a day's story

On `/trip-lines`, under the chosen day's route (the card with the photo strip and map), **Trip page story** lists every
photo of the day, with an exact spot or not, in the order they were taken, laid out in rows the way the page will be
(`components/trip-story/`, `lib/trip-story.ts`):

- **Before the first photo** is a Markdown paragraph that opens the day.
- Each photo has a **Caption** box. The caption shows in small text under the photo.
- **Same row as the next photo** puts the next photo beside the row's last one, up to 4 in a row, as in an album's
  layout. The unlink button between two photos in a row splits it there.
- **Add a paragraph** after a row opens a Markdown box for a paragraph between that photo and the next, shown across
  the page. A paragraph ends the row, so the two can't be on one photo. After the last row it's a closing paragraph.
- The eye button on a photo leaves it off the page; it moves to **Not on the page**, where clicking it puts it back.

The card says which Trip page the day goes on: the [Trip](trip-lines.md#trips) whose days include it, or else a page of
its own for that day alone. **Save story** saves it and **Remove story** takes the day off its page, each as a
[change waiting for Commit](pending-changes.md). A day without a saved story isn't on any Trip page.

A photo added to the day later shows in the editor in its place, and joins the page once the story is saved again. A
day's story is kept apart from its line, so the line can be redrawn, turned automatic or removed without touching it.

## The file

Each day's story is `triplines/story-<YYYY-MM-DD>.json`, in the trip lines folder next to the days' lines and the
Trips, so it's listed, combined into `TRIPLINES.json` and committed with them (`PUT` and
`DELETE /api/tripstories/story-<day>` → `/tripstories/{id}`, `be-pipeline/internal/github/trip_stories.go`):

```json
{
  "id": "story-2026-10-01",
  "date": "2026-10-01",
  "intro": "Our first afternoon in **Osaka**.",
  "photos": [
    { "id": 302, "caption": "The arcade roof kept the drizzle off", "withNext": true },
    { "id": 303, "caption": "Lanterns for the autumn festival" },
    { "id": 304, "after": "A short subway ride later we crossed the river." },
    { "id": 305 }
  ]
}
```

| Field               | Type              | Rules                                                                    |
| ------------------- | ----------------- | ------------------------------------------------------------------------ |
| `id`                | string            | `story-` and the day; the day comes from it                              |
| `date`              | string            | The day, such as `2026-10-01`. Not `day`, so it's never read as a line   |
| `intro`             | string (Markdown) | Left out for none; at most 5,000 characters                              |
| `photos`            | list              | The photos on the page, in order, at most 500. Each taken that day, once |
| `photos[].caption`  | string            | Left out for none; at most 500 characters                                |
| `photos[].withNext` | boolean           | Puts the next photo in the same row. Left out on a row's last photo      |
| `photos[].after`    | string (Markdown) | The paragraph after the photo; at most 5,000 characters. Ends the row    |

The backend trims the words, drops `withNext` from the last photo, and refuses a photo not taken that day (its custom
date, or else its EXIF one), a photo listed twice, a photo with both `withNext` and `after`, and a row of more than 4.

## The baked pages: `TRIPPAGES.json`

Every Commit also writes `triplines/TRIPPAGES.json` from the story and Trip files (`trip_pages.go`), newest first, and
counts its pages (`tripPages`). Like `TRIPLINES.geo.json`, it's left out of `TRIPLINES.json`, and the **Combine photo
data** workflow leaves it as it is.

```json
[
  {
    "id": "trip-japan-2026-09-22",
    "name": "Japan",
    "start": "2026-09-22",
    "end": "2026-10-02",
    "days": [
      {
        "day": "2026-10-01",
        "intro": "…",
        "photos": [{ "id": 302, "caption": "…", "withNext": true }]
      }
    ]
  },
  { "id": "day-2025-01-19", "name": "", "start": "2025-01-19", "end": "2025-01-19", "days": [] }
]
```

A Trip with a story on any of its days is one page, with those days in order. A day with a story in no Trip is a page of
its own, with the ID `day-` and the day and no name. The portfolio reads only this file, not every line's path.

> **Frontend analogy:** `TRIPPAGES.json` is a derived selector baked ahead of time: the day files are normalized
> state, and this is the denormalized view the page needs, so the browser doesn't load `TRIPLINES.json` to group them.

## On the portfolio

`/albums/trips/<id>` (`routes/albums.trips.$id.tsx`) shows the Trip's name, its days and how many photos it has, then
each day under its date: its first paragraph, then its rows (`components/trip-story.tsx`, `lib/trip-pages.ts`). A row's
photos are side by side at the same height, as an album's rows are (`components/album-rows.tsx`), each with its caption
under it; one photo is as large as it fits. On a phone a row's photos go one under another. A paragraph after a row
spans the text column. Clicking a photo opens the [photo viewer](photo-viewer.md), which steps through the page in
order. A day's page is titled with its date.

Photos the portfolio doesn't have, such as drafts or ones with no image yet, are left out; a row left empty is
dropped, and a photo left out still ends its row and keeps its paragraph. The [Albums](portfolio-albums.md) page lists
the Trip pages under **Trips**, after the albums.
