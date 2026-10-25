import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import type { TagEntry, TagSection } from "@/lib/tag-list";

/** "1 photo" or "N photos". */
function photoCount(count: number): string {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

/** The squares a card always shows, filled with its previews and empty after them. */
const SLOTS = [0, 1, 2];

/**
 * A tag as a card linking to the Grid filtered to it: its newest photos as square thumbnails, its
 * name after the tags between it and its section's parent, how many photos it has and its
 * description.
 */
export function TagCard({ entry }: { entry: TagEntry }) {
  const { tag, between, count, previews } = entry;
  return (
    <Link
      to="/grid"
      search={{ tag: tag.id }}
      className="group flex flex-col gap-3 rounded-lg border p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="grid grid-cols-3 gap-1.5">
        {SLOTS.map((slot) => (
          <div key={slot} className="aspect-square overflow-hidden rounded-md bg-muted">
            {previews[slot] && <PhotoThumbnail image={previews[slot].image} />}
          </div>
        ))}
      </div>
      <div>
        <p className="font-medium">
          {between.map((group) => (
            <span key={group.id} className="text-muted-foreground">
              {group.name} ›{" "}
            </span>
          ))}
          <span className="underline-offset-4 group-hover:underline">{tag.name}</span>
        </p>
        <p className="text-sm text-muted-foreground">{photoCount(count)}</p>
        {tag.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tag.description}</p>
        )}
      </div>
    </Link>
  );
}

/** The cards' grid: two columns on a phone, up to four on a wide screen. */
export const CARD_GRID = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

/**
 * A parent tag as a heading linking to the Grid filtered to it and every tag under it, with its
 * description and photo count, then a card for each tag under it.
 */
export function ParentTagSection({ section }: { section: TagSection }) {
  const { tag, count } = section.parent;
  return (
    <section aria-labelledby={`tag-${tag.id}`} className="flex flex-col gap-3">
      <div>
        <h2 id={`tag-${tag.id}`} className="text-xl font-semibold tracking-tight">
          <Link
            to="/grid"
            search={{ tag: tag.id }}
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
          >
            {tag.name}
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {tag.description} {photoCount(count)}, counting the tags under it.
        </p>
      </div>
      <ul className={CARD_GRID}>
        {section.children.map((entry) => (
          <li key={entry.tag.id}>
            <TagCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
