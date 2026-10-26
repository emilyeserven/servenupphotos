import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { useState } from "react";
import { CARD_GRID, ParentTagSection, TagCard } from "@/components/tag-card";
import { parseTagsSearch, TagControls } from "@/components/tag-controls";
import { TagSearchBox } from "@/components/tag-search-box";
import { type TagEntry, type TagSection, type TagSort, tagSections } from "@/lib/tag-list";
import { searchTags } from "@/lib/tag-search";
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
};

/**
 * Every tag with photos, each linking to the Grid filtered to it, by name or by how many photos
 * it has: parent tags first, each with the tags under it, then the rest; or only the top-level
 * tags, as one grid. The search box narrows them to the tags with its text in their name or
 * description.
 */
function TagsView() {
  const search = Route.useSearch();
  useRememberViewOptions("/tags", search);
  const sort = search.sort ?? "name";
  const top = search.top === true;
  const [query, setQuery] = useState("");
  const sections = searchTags(SECTIONS[sort], query);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <div>
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

/** The tags as one grid of cards. */
function CardList({ entries }: { entries: TagEntry[] }) {
  return (
    <ul className={CARD_GRID}>
      {entries.map((entry) => (
        <li key={entry.tag.id}>
          <TagCard entry={entry} />
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
