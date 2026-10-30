# Album Layouts and Covers

An album's page in the pipeline (`/albums/<id>`) has a **Layout and covers** card under its other cards. It sets how
the portfolio shows the album:

- **Covers**: up to 5 of the album's photos, in order, that stand for it on the portfolio's
  [Albums](portfolio-albums.md) page in place of its first 5. **Choose covers** opens the album's photos to click, in
  the order they should show; each cover's arrows move it one place, and its × takes it out.
- **Rows**: the album's page as a list of rows, each with Markdown text above, up to 4 photos side by side, and
  Markdown text below. **Add a row** adds an empty one, **Add photos** in a row picks from the photos not in a row yet
  (left to right in the order they're clicked), and each row's arrows and bin move or remove it. **Preview** by each
  text box shows the Markdown as the portfolio renders it (a single line break stays a line break). **Give each photo
  not in a row its own** adds a one-photo row for each of the rest, to start from the album's order.

The photos to pick from are the album's and its sub-albums', in the album's [photo order](albums-and-tags.md#photo-order).
**Save layout** saves both as the album file's `covers` and `layout`
(`PUT /api/organize/albums/<id>/layout` with `{ "covers": [...], "layout": [...] }`), a
[change waiting for Commit](pending-changes.md); **Undo** goes back to the file's. A row with neither photos nor text
can't be saved. Empty lists put the album back to its first 5 photos and one photo after another.

> **Frontend analogy:** the layout is like a CMS "page builder" block list: an ordered array of blocks (rows), each
> holding references to media by ID rather than the media itself, so a photo's own data can change without touching
> the layout.

## Preview

Right of the editor (under it on a narrow screen), **Preview** draws what's in the editor as the portfolio will show
it, as you type: the Albums page's strip of covers (or the first 5 photos), then each row's text and photos at their
own shapes, then the first few photos no row has. It draws each photo from its X-Small version (250px on its long
edge) through the backend's [offline copy](offline-mode.md) (`GET /api/thumbnails`), so a photo it has shown once
shows again without the internet. **Keep offline** downloads the X-Small version of every photo the album's layout can
use into the offline copy, four at a time, and says how many it kept, so the whole preview works offline.

> **Frontend analogy:** like a CMS's live preview pane bound to the same form state as the editor, with its images
> pre-cached the way a PWA precaches assets for offline use.

## The schema

Both fields sit at the top level of `albums/<id>.json`, next to `id`, `name`, `description` and the rest
([Photo, album, tag and genre data](data-model.md)), and **Commit** copies them into `ALLALBUMS.json`:

```json
{
  "id": "korea",
  "name": "Korea",
  "description": "Two weeks in spring.",
  "parent": null,
  "covers": [344, 7, 118],
  "layout": [
    {
      "textAbove": "## Seoul\nThe first week, **after the rain**.",
      "photos": [1, 344],
      "textBelow": ""
    },
    { "textAbove": "", "photos": [356, 7, 118], "textBelow": "*Last light* over the Han." }
  ]
}
```

| Field                | Type              | Rules                                                                              |
| -------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `covers`             | photo IDs         | At most 5, each once. Missing or `[]`: the album's first 5 photos                  |
| `layout`             | rows              | At most 200. Missing or `[]`: every photo, one after another, in the album's order |
| `layout[].textAbove` | string (Markdown) | Always written, `""` for none; at most 5,000 characters                            |
| `layout[].photos`    | photo IDs         | Always written; 0 to 4, left to right. A photo is in one row at most               |
| `layout[].textBelow` | string (Markdown) | Always written, `""` for none; at most 5,000 characters                            |

Photo IDs are the photos' `id`s ([Photo IDs](data-model.md#photo-ids)). The backend checks the rules above and trims
each text; it doesn't check that a photo is in the album, so the portfolio leaves out any ID that isn't one of the
album's photos with an image, and drops a row left with nothing in it.

## Export and import

**Export** downloads what's in the editor as `<id>.album.json`: the fields above with `format` and `version` first,
so the file says what it is, and the album's `id`, `name`, `description` and `parent` for reference:

```json
{
  "format": "servenup-album",
  "version": 1,
  "id": "korea",
  "name": "Korea",
  "description": "Two weeks in spring.",
  "parent": null,
  "covers": [344, 7, 118],
  "layout": [{ "textAbove": "", "photos": [1, 344], "textBelow": "" }]
}
```

**Import** takes a file like that, pasted or loaded from the computer, or an album's own JSON file (one without
`format`), and reads only its `covers` and `layout` into the editor, to look over before **Save layout**. A row may
leave out `textAbove`, `textBelow` or `photos`. It refuses text that isn't a JSON object, a `format` other than
`servenup-album`, a newer `version`, a row with more than 4 photos, and a file with neither `covers` nor `layout`.
It leaves out, saying so, photos that aren't in the album, a photo listed twice, covers past the fifth, and rows left
empty. A file from another album (another `id`) is allowed, with a note, so one album's layout can start another's.

> **Frontend analogy:** like exporting and importing a settings JSON in an app: the file carries a `format` and
> `version` so a future shape can be told apart, and the import validates and normalizes it into form state rather
> than saving it straight away.

## On the portfolio

An album's page ([Portfolio Albums](portfolio-albums.md#an-albums-page)) shows its rows first: each row's text above,
in a column lined up with the album's name, its photos side by side at the same height (each as wide as its shape
makes it, and the row no taller than the screen), or one photo as large as it fits, then its text below. On a phone a
row's photos go one under another. The photos no row has come after the rows, one under another, in the album's
order. The photo viewer steps through them all in that order.
