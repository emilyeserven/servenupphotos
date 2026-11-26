# Remembered view settings

Each of these views remembers its own settings in this browser (`lib/view-options.ts`, saved under `servenup-view-options` in `localStorage`), so leaving it and coming back from another page opens it the same way:

- **Grid:** square, natural or Table view, **info** under the tiles, the sort (with a color sort's order and secondary sort), and the Table's sorted column, hidden columns and Place detail.
- **Color:** the color wheel or Black & white view, and the preview size.
- **Timeline:** its display options, such as technical info shown and thumbnail size.
- **Tags:** the sort, and all tags or the top level only.

Filters (including the Timeline's date range), the open photo and where the Map is looking aren't remembered this way. The Map's display options are remembered on their own (see [Portfolio Map](../portfolio-map.md)). A link with settings in its URL still opens with them, and a URL without any opens the view's defaults: only links within the site add the remembered ones.

> **Frontend analogy:** each view's route component writes its settings slice of the search params to `localStorage` in a `useEffect`, and links to it build their `search` from that saved slice plus the filters, like restoring a tab's last state.
