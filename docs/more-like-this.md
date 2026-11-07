# More Like This

The portfolio's [photo viewer](photo-viewer.md) has a **More like this** drawer down its left side. The **Related**
button among the viewer's buttons at the top, left of the link button, opens it or closes it (or the **M** key); its
tooltip says "Related (M)", and it's highlighted while the drawer is open. The drawer lists up to 6 related photos, one
per line: each one's square thumbnail, with its title to the right and, for a photo picked by hand, the note written
for it under the title. Clicking one shows that photo in the viewer with the drawer still open, so you can keep
following related photos. The drawer slides in over the photo's left side, so the photo keeps the same size and padding
whether it's open or not.

Whether the drawer is open is remembered in the browser, between photos and visits, under `servenup-more-like-this`.
Hiding the details (the eye button or **H**) hides the button and the drawer too. A photo with no related photos has no
Related button.

A related photo may not be among the photos the page moves through (such as a Grid filtered to another city). Shown from
the drawer, it has no **‹ ›** buttons or count, as there's nowhere among the page's photos for it to be; the drawer
and **Esc** still work.

## Which photos it shows

The portfolio doesn't work out which photos are alike: it reads two lists of photo IDs from each photo's JSON (see
[Photo data](data-model.md)) and shows the first 6 photos it can show:

1. `pickedSimilar`, the photos picked by hand on the pipeline's **Related Photos** page, in the order picked, each
   with its note from `pickedSimilarNotes` (by the picked photo's ID), if it has one.
2. `similarPhotos`, the photos **Find related photos** found, best first, leaving out any already picked. These have
   no notes.

It's `MoreLikeThis` in `apps/portfolio/src/components/more-like-this.tsx`, and `related` on the portfolio's `Photo`,
made by `relatedPhotos` in `apps/portfolio/src/lib/related-photos.ts`.

> **Frontend analogy:** this is precomputing at build time instead of at render time. Comparing every photo with every
> other is like a `useMemo` over hundreds of items on each open; saving the result in the data is like generating a
> static lookup table once, so the page only does `ids.map(byId)`.

## Related Photos page

The pipeline's **Related Photos** page (`/related-photos`, under Publish) has two cards.

**Find related photos** has the backend read every photo file as the next Commit will have them and score each pair:

| What they share                 | Score                                    |
| ------------------------------- | ---------------------------------------- |
| Each tag                        | 3                                        |
| Each genre                      | 2                                        |
| Each album                      | 2                                        |
| The same city (or else country) | 2 (or 1)                                 |
| Taken on the same day           | 2                                        |
| The same colors                 | up to 6, by how much of both is the same |

The colors are the hue buckets and shades the portfolio's Color page uses; the overlap adds up, for each color, the
smaller of the two photos' shares. A pair needs at least 3 to count, such as one shared tag. Each photo keeps its 6
best, with ties going to the photo taken closest in time, in `similarPhotos`. Only photos with an image are listed.
Only files whose list changed are saved, as changes waiting for Commit (see [Pending changes](pending-changes.md)).
Smart Albums aren't counted, as only the portfolio works them out. Run it again after adding or tagging photos.

**Pick related photos by hand** chooses a photo, then lists:

- its picks, up to 6 (as many as the drawer shows), which the drawer shows first, one per line: each one's thumbnail
  and title, a box for its note (up to 280 characters, shown to the right of the photo in the drawer), arrows to
  reorder them, **×** to take one out, and **Save picks**;
- the photos **Find related photos** found for it, each with **Pick**;
- every other photo, with a search, to pick any of them.

**Save picks** saves `pickedSimilar` and `pickedSimilarNotes` on that one photo, as a change waiting for Commit. Notes
are trimmed, and empty ones are left out.

## On the Photo page

The Photo page (Edit Photo) has the same picker in its **More like this** card: the picks, the photos found for it,
and every other photo, with a note for each pick. Its picks are saved with the photo's other changes, by the page's own
Save, into the JSON's `pickedSimilar` and `pickedSimilarNotes`. Both pickers use `PickedSimilarFields` in
`apps/client-pipeline/src/components/related-photos/picked-similar-fields.tsx`.

| Endpoint                              | What it does                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST /api/data/related-photos`       | Finds every photo's related photos and saves them                                   |
| `PUT /api/data/related-photos/picked` | Saves one photo's picks: `{ "path": "…", "ids": [12, 40], "notes": { "12": "…" } }` |

They're `FindSimilarPhotos` and `SetPickedSimilar` in `apps/be-pipeline/internal/github/similar.go`. All three fields are
in `newPhotoJSON`, so Update Data's **Missing fields** adds them, empty, to older files.

> **Frontend analogy:** the backend's score is a weighted sum, like ranking search results by how many filter chips
> each one matches, with some chips worth more than others.
