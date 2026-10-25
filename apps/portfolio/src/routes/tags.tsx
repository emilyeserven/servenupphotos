import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { CARD_GRID, ParentTagSection, TagCard } from "@/components/tag-card";
import { tagSections } from "@/lib/tag-list";

export const Route = createFileRoute("/tags")({
  component: TagsView,
});

// Worked out once: the photos only change with a new build. Tags without photos are left out.
const sections = tagSections();
/** The parent tags, each shown with the tags under it. */
const parents = sections.filter((section) => section.children.length > 0);
/** The tags with none under them, shown together as cards. */
const loose = sections.filter((section) => section.children.length === 0).map((s) => s.parent);

/**
 * Every tag with photos, each linking to the Grid filtered to it: parent tags first, each with
 * the tags under it, then the rest, by name.
 */
function TagsView() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Tags className="size-8 text-muted-foreground" aria-hidden />
          Tags
        </h1>
        <p className="mt-2 text-muted-foreground">
          What's in the photos. Open a tag to see its photos on the Grid.
        </p>
      </header>
      {sections.length === 0 && <p className="text-muted-foreground">No tags have photos yet.</p>}
      {parents.map((section) => (
        <ParentTagSection key={section.parent.tag.id} section={section} />
      ))}
      {loose.length > 0 && (
        <section aria-label="Tags" className="flex flex-col gap-3">
          {parents.length > 0 && (
            <h2 className="text-xl font-semibold tracking-tight">More tags</h2>
          )}
          <ul className={CARD_GRID}>
            {loose.map((entry) => (
              <li key={entry.tag.id}>
                <TagCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
