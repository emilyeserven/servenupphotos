# Quick Edit

The sidebar's **Quick Edit** button, under **Bulk Upload** (`components/quick-edit-button.tsx`), opens a modal with one
field: paste a link from the portfolio and the pipeline opens the page that edits what the link shows. Pasting into the
empty field goes there at once when the link matches; otherwise the modal says where **Open** goes, or why it can't.

`lib/quick-edit.ts` (`quickEditTarget`, tested in `quick-edit.test.ts`) reads the link. It takes a full link
(`https://servenupphotos.net/…`), one without its `https://`, a path on its own, or the portfolio running on
`localhost`; a link to any other site is refused. What it opens, first match wins:

| Portfolio link                                                    | Pipeline page                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Any page with `?photo=<id>`, or a photo's own `/photos/<id>/`     | The Photo page's editor for that photo (`/exif?photo=<id>`)          |
| `/albums/trips/<id>`                                              | The Trip's page in Trip Lines (`/trip-lines/trips/<id>`)             |
| `/albums/trips/day-<date>` (a day in no Trip)                     | That day in Trip Lines (`/trip-lines/<date>`)                        |
| `/albums/<id>`                                                    | The album's page (`/albums/<id>`)                                    |
| `/maps/<kind>/<slug>/` (a country, state, city or place)          | Places with that row open (`/places?edit=<kind>/<slug>`)             |
| A view filtered on `?album=`, `?tag=` or `?genre=`                | That album's, tag's or genre's page                                  |
| A view filtered on `?place=`, `?city=`, `?state=` or `?country=`  | Places with that row open                                            |
| `/`, `/albums`, `/tags`, `/bio`, `/likes`, `/graph`, `/maps/all/` | Site Spotlight, Albums, Tags, Bio, User Likes, Graph Presets, Places |

A view of many photos with none of these, such as `/grid?size=large`, has nothing to open, and the modal says so.

The same matching runs as a page: `/quick-edit?url=<portfolio link>` redirects straight to the link's page, or shows
why it can't with the field to paste another. The [Chrome extension](chrome-extension.md) opens it.

The Places page reads `?edit=` once as it opens and selects that row: a place by its ID, a country, state or city by its
name written the way map page addresses write it (`placeSlug` in the portfolio's `lib/place-slug.ts`, shared with
`map-pages.ts`).

> **Frontend analogy:** it's a tiny client-side router of its own: it pattern-matches the portfolio's route (path and
> search params) and maps each to the pipeline route that edits the same record, the way a CMS's "Edit this page"
> link knows which admin screen belongs to a public URL.
