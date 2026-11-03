import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { useState } from "react";
import { SiteHomeLink } from "@/components/site-home-link";
import { CARD_GRID, ParentTagSection, SPOTLIGHT_GRID, TagCard } from "@/components/tag-card";
import { parseTagsSearch, TagControls } from "@/components/tag-controls";
import { TagSearchBox } from "@/components/tag-search-box";
import {
  favoriteTags,
  type TagEntry,
  type TagSection,
  type TagSort,
  tagSections,
} from "@/lib/tag-list";
import { searchTagEntries, searchTags } from "@/lib/tag-search";
import { useRememberViewOptions } from "@/lib/view-options";

export const Route = createFileRoute("/tags")({
  validateSearch: parseTagsSearch,
  component: TagsView,
});

// Worked out once for each sort: the photos only change with a new build. Tags without photos are
// left out.
const SECTIONS: Record<TagSort, TagSection[]> = {
  name: tagSections("name"),
  count: tagSections("count"),
  subtags: tagSections("subtags"),
};

// The favorite tags, set on the pipeline, for the top of the page, in each sort's order.
const FAVORITES: Record<TagSort, TagEntry[]> = {
  name: favoriteTags("name"),
  count: favoriteTags("count"),
  subtags: favoriteTags("subtags"),
};

/**
 * Every tag with photos, each linking to the Grid filtered to it, by name, by how many photos it
 * has or by how many tags are under it: parent tags first, each with the tags under it, then the rest; or only the top-level
 * tags, as one grid. Favorite tags come first, under Spotlight Tags. The search box narrows them to the tags with its text in their name or
 * description.
 */
function TagsView() {
  const search = Route.useSearch();
  useRememberViewOptions("/tags", search);
  const sort = search.sort ?? "name";
  const top = search.top === true;
  const [query, setQuery] = useState("");
  const sections = searchTags(SECTIONS[sort], query);
  const favorites = searchTagEntries(FAVORITES[sort], query);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <div>
          <SiteHomeLink className="mb-1" />
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Tags className="size-8 text-muted-foreground" aria-hidden />
            Tags
          </h1>
          <p className="mt-2 text-muted-foreground">
            What's in the photos. Open a tag to see its photos on the Grid.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TagSearchBox value={query} onChange={setQuery} />
          <TagControls sort={sort} top={top} />
        </div>
      </header>
      {sections.length === 0 && <NoTags query={query} />}
      <SpotlightTags entries={favorites} />
      {top ? <CardList entries={sections.map((s) => s.parent)} /> : <Grouped sections={sections} />}
    </div>
  );
}

/** The parent tags, each with the tags under it, then the rest as one grid. */
function Grouped({ sections }: { sections: TagSection[] }) {
  const parents = sections.filter((section) => section.children.length > 0);
  const loose = sections.filter((section) => section.children.length === 0).map((s) => s.parent);
  return (
    <>
      {parents.map((section) => (
        <ParentTagSection key={section.parent.tag.id} section={section} />
      ))}
      {loose.length > 0 && (
        <section aria-label="Tags" className="flex flex-col gap-3">
          {parents.length > 0 && (
            <h2 className="text-xl font-semibold tracking-tight">More tags</h2>
          )}
          <CardList entries={loose} />
        </section>
      )}
    </>
  );
}

/**
 * The favorite tags, set on the pipeline, as wider cards headed Spotlight Tags, with a divider
 * under them; nothing when there are none.
 */
function SpotlightTags({ entries }: { entries: TagEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-label="Spotlight tags" className="flex flex-col gap-3 border-b pb-10">
      <h2 className="text-xl font-semibold tracking-tight">Spotlight Tags</h2>
      <CardList entries={entries} wide />
    </section>
  );
}

/** The tags as one grid of cards; wide ones, two to a row, for Spotlight Tags. */
function CardList({ entries, wide = false }: { entries: TagEntry[]; wide?: boolean }) {
  return (
    <ul className={wide ? SPOTLIGHT_GRID : CARD_GRID}>
      {entries.map((entry) => (
        <li key={entry.tag.id}>
          <TagCard entry={entry} wide={wide} />
        </li>
      ))}
    </ul>
  );
}

/** What the page says when no tags are shown: none have photos, or none match the search. */
function NoTags({ query }: { query: string }) {
  const text = query.trim();
  return (
    <p className="text-muted-foreground">
      {text ? `No tags match “${text}”.` : "No tags have photos yet."}
    </p>
  );
}
