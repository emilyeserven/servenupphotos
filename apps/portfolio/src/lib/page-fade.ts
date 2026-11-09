/** Which page a view transition goes from and to, as the router tells `pageFade`. */
interface PageChange {
  /** Where it came from; undefined when the site first opens, which draws at once with no fade. */
  fromLocation?: unknown;
  /** Whether the path changed, so it's a different page and not only new search or hash. */
  pathChanged: boolean;
}

/**
 * The router's `defaultViewTransition`: a page switch, where the path changes, runs as a view
 * transition of the type `page`, which `page-fade.css` fades out and back in. A change to only the
 * search or hash, such as a filter on the Grid, and the first page drawn swap at once with no
 * fade. The pipeline uses it too. See docs/page-fade.md.
 */
export const pageFade = {
  types: ({ fromLocation, pathChanged }: PageChange) =>
    fromLocation && pathChanged ? ["page"] : false,
};
