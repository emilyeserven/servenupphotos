# More Like This

The portfolio's [photo viewer](photo-viewer.md) has a **More like this** drawer along its bottom, like Lightroom's
filmstrip. A short tab with an up arrow, in the middle under the photo, slides it open (or the **M** key); the tab's
arrow then points down to close it. The drawer is a row of up to 6 square thumbnails, scrolling sideways, and clicking
one shows that photo in the viewer with the drawer still open, so you can keep following similar photos.

Whether the drawer is open is remembered in the browser, between photos and visits, under `servenup-more-like-this`.
Hiding the details (the eye button or **H**) hides the tab and the drawer too. A photo with no similar photos has no
tab.

A similar photo may not be among the photos the page moves through (such as a Grid filtered to another city). Shown from
the drawer, it has no **‹ ›** buttons or count, as there's nowhere among the page's photos for it to be; the drawer
and **Esc** still work.

## Which photos it shows

The portfolio doesn't work out which photos are alike: it reads two lists of photo IDs from each photo's JSON (see
[Photo data](data-model.md)) and shows the first 6 photos it can show:

1. `pickedSimilar`, the photos picked by hand on the pipeline's **Similar Photos** page, in the order picked.
2. `similarPhotos`, the photos **Find similar photos** found, best first, leaving out any already picked.

It's `MoreLikeThis` in `apps/portfolio/src/components/more-like-this.tsx`, and `similar` on the portfolio's `Photo`
(`apps/portfolio/src/lib/photos.ts`).

> **Frontend analogy:** this is precomputing at build time instead of at render time. Comparing every photo with every
> other is like a `useMemo` over hundreds of items on each open; saving the result in the data is like generating a
> static lookup table once, so the page only does `ids.map(byId)`.

## Similar Photos page

The pipeline's **Similar Photos** page (`/similar-photos`, under Publish) has two cards.

**Find similar photos** has the backend read every photo file as the next Commit will have them and score each pair:

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

**Pick similar photos by hand** chooses a photo, then lists:

- its picks, up to 6 (as many as the drawer shows), which the drawer shows first, with arrows to reorder them and
  **×** to take one out, and **Save picks**;
- the photos **Find similar photos** found for it, each with **Pick**;
- every other photo, with a search, to pick any of them.

**Save picks** saves `pickedSimilar` on that one photo, as a change waiting for Commit.

## On the Photo page

The Photo page (Edit Photo) has the same picker in its **More like this** card: the picks, the photos found for it,
and every other photo. Its picks are saved with the photo's other changes, by the page's own Save, into the JSON's
`pickedSimilar`. Both pickers use `PickedSimilarFields` in
`apps/client-pipeline/src/components/similar-photos/picked-similar-fields.tsx`.

| Endpoint                              | What it does                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `POST /api/data/similar-photos`       | Finds every photo's similar photos and saves them           |
| `PUT /api/data/similar-photos/picked` | Saves one photo's picks: `{ "path": "…", "ids": [12, 40] }` |

They're `FindSimilarPhotos` and `SetPickedSimilar` in `apps/be-pipeline/internal/github/similar.go`. Both fields are
in `newPhotoJSON`, so Update Data's **Missing fields** adds them, empty, to older files.

> **Frontend analogy:** the backend's score is a weighted sum, like ranking search results by how many filter chips
> each one matches, with some chips worth more than others.
