# Portfolio Tags

The portfolio's Tags page (`/tags`, `apps/portfolio/src/routes/tags.tsx`) lists every tag that has photos, each as a card
with its 3 newest photos as square thumbnails, its name, how many photos it has and its description. Clicking a card
opens the [Grid](portfolio-grid.md) filtered to that tag (`/grid?tag=shotengai`), which uses the same
[Tag filter](portfolio-filters.md#album-tag-and-genre) as the Timeline and Map. It's in the site menu after Albums;
like Albums, the homepage doesn't link to it.

## Parent tags

A tag with tags under it (its [parent](albums-and-tags.md#parent-tags), set on the pipeline) gets a section of its own, at the top
and by name: its name links to the Grid filtered to it, and its description and photo count count the photos of every
tag under it too, as the Tag filter does. Below are cards for every tag under it, however deep, by name, each one's own
tags right after it. A tag more than one level down names the tags in between (`shimenawa › shide`).

The tags with none under them come after the parent tags as one grid of cards, by name, headed **More tags** when there
are parent tags above. Tags without photos are left out, and a loop of parents stops where it comes back round.

> **Frontend analogy:** the page is a static tree render worked out once at build time, like a `useMemo` with no
> dependencies: `lib/tag-list.ts` walks `ALLTAGS.json` (`lib/groups.ts`) from the top-level tags down, and each card is
> just a `<Link to="/grid" search={{ tag }}>`.
