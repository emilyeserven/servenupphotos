# Portfolio Tags

The portfolio's Tags page (`/tags`, `apps/portfolio/src/routes/tags.tsx`) lists every tag that has photos, each as a card
with its 3 newest photos as square thumbnails, its name followed by how many photos it has (`torii · 3 photos`), and
its description when one is written. Clicking a card
opens the [Grid](portfolio-grid.md) filtered to that tag (`/grid?tag=shotengai`), which uses the same
[Tag filter](portfolio-filters.md#album-tag-and-genre) as the Timeline and Map. It's in the site menu after Albums;
like Albums, the homepage doesn't link to it.

## Parent tags

A tag with tags under it (its [parent](albums-and-tags.md#parent-tags), set on the pipeline) gets a section of its own, at the top
and by name: its name links to the Grid filtered to it, followed by its photo count, which counts the photos of every
tag under it too, as the Tag filter does, then its description when one is written. Below, when photos are tagged with the parent tag itself, comes a card of their 3 newest thumbnails without a
name, linking to the Grid filtered to the parent tag; then cards for every tag under it, however deep, by name, each one's own
tags right after it. A tag more than one level down names the tags in between (`shimenawa › shide`).

The tags with none under them come after the parent tags as one grid of cards, by name, headed **More tags** when there
are parent tags above. Tags without photos are left out, and a loop of parents stops where it comes back round.

> **Frontend analogy:** the page is a static tree render worked out once at build time, like a `useMemo` with no
> dependencies: `lib/tag-list.ts` walks `ALLTAGS.json` (`lib/groups.ts`) from the top-level tags down, and each card is
> just a `<Link to="/grid" search={{ tag }}>`.

## Sorting and top level only

Two rows of buttons under the title change what the page shows, and are kept in the URL so a link keeps them:

- **A–Z** (the default) or **Most photos** (`?sort=count`): orders the parent tags' sections, the tags in each
  section (each among the tags beside it, so a tag's own tags still come right after it) and the **More tags** grid.
  **Most photos** puts the tags with the most photos first, and tags with as many photos by name.
- **All tags** (the default) or **Top level only** (`?top=true`): hides every tag that has a parent and drops the
  sections, leaving one grid of the top-level tags. A parent tag's count there still counts the photos of the tags
  under it, as its link to the Grid does.

The page works out both orders once at build time (`tagSections("name")` and `tagSections("count")`), so switching is
instant.
