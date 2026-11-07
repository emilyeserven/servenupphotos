# Smart Albums

A Smart Album is an album whose photos come from saved rules rather than being picked one by one, such as "every
vertical photo from the Japan trip". Its rules are the portfolio [Grid's filters](portfolio-filters.md) (places, album,
tag, genre, camera, lens, the ISO, exposure, focal length, aperture and time of day sliders, orientation and colors),
plus three of its own: a [timeline label](timeline-labels.md) whose days its photos were taken on, and **Taken on or
after** and **Taken on or before** days. A photo has to match every rule, the same way the Grid's filters combine, and
a photo taken on a new day or given a new tag joins (or leaves) the album on its own.

> **Frontend analogy:** a regular album is a hand-curated array of IDs; a Smart Album is a saved `filter()` predicate,
> like a saved search in an email client, re-run over the photos whenever they change.

## Making one

Every album's page in the pipeline (`/albums/<id>`) starts with a **Smart Album** card. **Pick its photos with rules**
(or **Edit rules** on one that has them) opens the editor:

- the **Timeline label**, **Taken on or after** and **Taken on or before** fields,
- the same **Show filters** panel as the [Gallery](gallery.md#the-portfolio-grids-filters), with the portfolio's own
  components, whose counts are out of every photo in `ALLPHOTOS.json` (they don't take the label or days into
  account),
- how many photos the rules match, and the first 12 of them.

The rules being edited live in the album page's URL under the Grid's own names (`?tag=night&orientation=vertical`,
plus `?label=`, `?from=` and `?to=`), so the filters work exactly as they do on the Gallery. **Save rules**
(`PUT /api/organize/albums/<id>/rules` with `{ "rules": { … } }`) writes them into the album file's `rules` as a
[change waiting for Commit](pending-changes.md), and takes them out of the URL again; **Cancel** drops them. **Stop
using rules** saves `{ "rules": null }`, making it an album of chosen photos again. The backend refuses a rule that
isn't one of these filters, or a value that isn't text, a number or a list of them.

A Smart Album is only what its rules match: it has no **Add photos**, **Remove photos** or **Layout and covers**, a
photo whose own JSON lists it isn't in it for that, and the portfolio shows its first photos as its covers and one
photo after another on its page, ignoring any `covers` or `layout` left in its file. Its **Reorder**, **On the
portfolio** (hiding) and parent work as for any album. The Albums list marks each one **Smart Album**.

A rule naming an album (`album`) can name another Smart Album, matching that album's photos, so "the vertical photos
of the Japan Smart Album" works. Albums whose rules only name each other stay empty. A label rule whose timeline
label has been deleted matches no photos.

## The schema

The album file's `rules` is an object of the Grid's URL values, saved as they'd appear in a Grid link:

```json
{
  "id": "japan-verticals",
  "name": "Japan, vertical",
  "description": "",
  "parent": null,
  "rules": { "label": "japan-2026-09-22", "orientation": "vertical", "place": ["kyoto", "nara"] }
}
```

Missing, `null` or `{}` means an album of chosen photos. Commit copies it into `ALLALBUMS.json` with the rest of the
file.

## Where its photos are worked out

Nothing writes the Smart Album into the photo files. Instead, `withSmartAlbums` in
`apps/portfolio/src/lib/smart-albums.ts` takes every Smart Album out of each photo's own `albums`, then adds each
Smart Album's ID to every photo its rules match, when the photos are read (`photosFromData` in `lib/photos.ts`). It
goes round again until nothing changes (at most once per Smart Album, plus one), so a rule naming another Smart Album
sees that album's photos. On the portfolio that happens with the data the site
was built with, so every view sees the same thing: the album's page and its strip on the [Albums](portfolio-albums.md)
page, the Grid's **Groups** filter and its counts, and a [spotlight zone](publish.md#site-spotlight) showing it. A
hidden Smart Album stays off the album lists and pages, as any [hidden album](albums-and-tags.md#showing-or-hiding-on-the-portfolio)
does.

In the pipeline, `currentPhotos` (`lib/group-photos.ts`) does the same with `ALLPHOTOS.json`, `ALLALBUMS.json` and
`TIMELINE.json` from the [combined data store](combined-data-store.md), changes waiting for Commit included, so an
album's page and photo counts follow its rules as soon as they're saved. The Gallery's filters use the albums the
pipeline was built with, like its other choices.

> **Frontend analogy:** it's a derived selector rather than stored state: like a `useMemo` that maps over the photos
> and appends computed album IDs, so nothing has to be kept in sync when a photo or a rule changes.
