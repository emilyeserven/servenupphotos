# Portfolio Filters

The Grid and Timeline also have a [text search](portfolio-filters/text-search.md) box. The portfolio's Timeline, Map and Grid each have a **Show filters** button under their title, which opens filters that narrow the photos they show: **Places**, [Groups](portfolio-filters/groups.md) and [When](portfolio-filters/when.md) (**Hide filters** closes them again). The Grid and the Timeline also have the camera filters (see [Camera filters](portfolio-filters/camera-filters.md)), the Grid in each of its views, including the Table. Every view with filters (the Grid, Lucky, the Graph page, the Timeline and, under **More filters**, the Map) also has a **Visuals** button, which opens the Color page's color filters and **Orientation** (see [Portfolio Color](portfolio-color.md#on-the-grid-page)). Where the camera filters are, it comes with them (`CameraFilterBar`); the Map adds it as its own filters (`visualsOwnFilters`, read with `lib/visual-filters.ts`). The dropdowns start hidden on each view; while filters are set, the button shows how many, and pointing at it swaps that number for an X that clears them all (see [Clearing filters](portfolio-filters/clearing-filters.md)). Each filter that's set also has a small X inside its border, to the right of what's chosen, which clears just that one (a range slider's X sits beside its range). The filters are kept in the URL, so a link keeps them, and the menu's view links carry them to the other views. A view's own settings, such as the Grid's sort or its Table's columns, stay with that view, and are remembered in this browser: the menu's links, the homepage's, the Tags page's cards and the Map's **View in grid** open a view the way it was last left (see [Remembered view settings](portfolio-filters/remembered-view-settings.md)). The Map is the exception: it always opens with no filters from the menu, or from the photo viewer's **View on map** on another view, so filters set earlier don't follow you back to it. A link to the Map with filters in its URL still opens with them.

> **Frontend analogy:** like TanStack Router search params shared by sibling routes: each route's `validateSearch` reads the same filter keys, and the menu's `<Link search={(prev) => parseFilters(prev)}>` passes them along.

## Parts

Each filter and part of the filters has its own file in [`portfolio-filters/`](portfolio-filters):

- [Text search](portfolio-filters/text-search.md)
- [Places](portfolio-filters/places.md)
- [Chosen photos](portfolio-filters/chosen-photos.md)
- [Groups: Album, Tag and Genre](portfolio-filters/groups.md)
- [When](portfolio-filters/when.md)
- [Picker layout](portfolio-filters/picker-layout.md)
- [Clearing filters and the picker conventions](portfolio-filters/clearing-filters.md)
- [Camera filters and metadata groups](portfolio-filters/camera-filters.md)
- [Counts](portfolio-filters/counts.md)
- [Remembered view settings](portfolio-filters/remembered-view-settings.md)
