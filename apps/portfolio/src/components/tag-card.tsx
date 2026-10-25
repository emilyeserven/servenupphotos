import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import type { ImagePhoto } from "@/lib/spotlight-zones";
import type { TagEntry, TagSection } from "@/lib/tag-list";

/** "1 photo" or "N photos", in small grey type after a tag's name. */
function PhotoCount({ count }: { count: number }) {
  return (
    <span className="text-sm font-normal text-muted-foreground">
      {" "}
      · {count} {count === 1 ? "photo" : "photos"}
    </span>
  );
}

/** The tag's description, when one is written. */
function Description({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return <p className={`text-sm text-muted-foreground ${className ?? ""}`}>{text}</p>;
}

/** The squares a card always shows, filled with its previews and empty after them. */
const SLOTS = [0, 1, 2];

/** A card's row of square thumbnails, empty squares after the photos it has. */
function Thumbnails({ previews }: { previews: ImagePhoto[] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {SLOTS.map((slot) => (
        <div key={slot} className="aspect-square overflow-hidden rounded-md bg-muted">
          {previews[slot] && <PhotoThumbnail image={previews[slot].image} />}
        </div>
      ))}
    </div>
  );
}

/** A card's box, a link to the Grid filtered to the tag. */
const CARD =
  "group flex h-full flex-col gap-3 rounded-lg border p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A tag as a card linking to the Grid filtered to it: its newest photos as square thumbnails, its
 * name after the tags between it and its section's parent with how many photos it has, and its
 * description when one is written.
 */
export function TagCard({ entry }: { entry: TagEntry }) {
  const { tag, between, count, previews } = entry;
  return (
    <Link to="/grid" search={{ tag: tag.id }} className={CARD}>
      <Thumbnails previews={previews} />
      <div>
        <p className="font-medium">
          {between.map((group) => (
            <span key={group.id} className="text-muted-foreground">
              {group.name} ›{" "}
            </span>
          ))}
          <span className="underline-offset-4 group-hover:underline">{tag.name}</span>
          <PhotoCount count={count} />
        </p>
        <Description text={tag.description} className="mt-1 line-clamp-2" />
      </div>
    </Link>
  );
}

/** The cards' grid: two columns on a phone, up to four on a wide screen. */
export const CARD_GRID = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

/**
 * A parent tag as a heading linking to the Grid filtered to it and every tag under it, with its
 * photo count (counting the tags under it) and its description when one is written, then a card
 * for each tag under it.
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
            className="group inline-flex items-center gap-1.5"
          >
            <span>
              <span className="underline-offset-4 group-hover:underline">{tag.name}</span>
              <PhotoCount count={count} />
            </span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </h2>
        <Description text={tag.description} />
      </div>
      <ul className={CARD_GRID}>
        <OwnPhotosCard tag={tag} previews={section.own} />
        {section.children.map((entry) => (
          <li key={entry.tag.id}>
            <TagCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The photos tagged with the parent tag itself, as a card of thumbnails without a name, linking to
 * the Grid filtered to the parent tag; nothing when none are.
 */
function OwnPhotosCard({ tag, previews }: { tag: TagEntry["tag"]; previews: ImagePhoto[] }) {
  if (previews.length === 0) return null;
  return (
    <li>
      <Link
        to="/grid"
        search={{ tag: tag.id }}
        aria-label={`Photos tagged ${tag.name}`}
        className={CARD}
      >
        <Thumbnails previews={previews} />
      </Link>
    </li>
  );
}
