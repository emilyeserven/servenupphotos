import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { CARD_GRID, ParentTagSection, TagCard } from "@/components/tag-card";
import { parseTagsSearch, TagControls } from "@/components/tag-controls";
import { type TagEntry, type TagSection, type TagSort, tagSections } from "@/lib/tag-list";

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
 * tags, as one grid.
 */
function TagsView() {
  const search = Route.useSearch();
  const sort = search.sort ?? "name";
  const top = search.top === true;
  const sections = SECTIONS[sort];
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
        <TagControls sort={sort} top={top} />
      </header>
      {sections.length === 0 && <p className="text-muted-foreground">No tags have photos yet.</p>}
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
