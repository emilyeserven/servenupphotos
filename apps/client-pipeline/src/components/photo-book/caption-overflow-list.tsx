import { TriangleAlertIcon } from "lucide-react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { pageName } from "@/components/photo-book/page-types";
import { overflowingCaptions } from "@/lib/caption-overflow";
import type { PhotoBook } from "@/lib/photo-book";
import { photoName } from "@/lib/social-schedule";
import { useCaptionOverflowStore } from "@/stores/caption-overflow";
import { count } from "@portfolio/lib/words";

interface CaptionOverflowListProps {
  book: PhotoBook;
  look: Pick<PageLook, "photos" | "captionFor">;
  /** Shows the page or spread with ID id in the preview. */
  onShow: (id: string) => void;
}

/**
 * Under the Book tab's preview: the captions in the book that overflow their room, each naming its
 * page and photo, to click to show that page; nothing when every caption fits. A caption is
 * checked once its page has been drawn, here or on Photo Pages.
 */
export function CaptionOverflowList({ book, look, onShow }: CaptionOverflowListProps) {
  const captions = useCaptionOverflowStore((state) => state.captions);
  const over = overflowingCaptions(book, captions, look.captionFor);
  if (over.length === 0) return null;
  return (
    <section
      aria-label="Captions that overflow"
      className="mt-3 flex flex-col gap-1.5 rounded-md border border-red-600/40 p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-medium">
        {/* oxlint-disable-next-line servenup/error-note -- a warning icon, not an error message */}
        <TriangleAlertIcon className="size-4 text-red-600" />
        {count(over.length, "caption")}{" "}
        {over.length === 1 ? "overflows its room" : "overflow their room"}
      </p>
      <p className="text-muted-foreground text-xs">
        Their text runs past the room the layout gives them, or off the page. Shorten them, hide a
        place, or give the page a layout with more room.
      </p>
      <ul className="flex flex-col">
        {over.map((item, i) => {
          const photo = look.photos.get(item.photo);
          return (
            <li key={`${item.page.id}-${i}`}>
              <button
                type="button"
                onClick={() => onShow(item.unit)}
                className="hover:bg-accent flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-xs"
              >
                <span className="text-muted-foreground w-14 shrink-0">Page {item.number}</span>
                <span className="min-w-0 flex-1 truncate">
                  {photo ? photoName(photo) : "A caption"} · {pageName(item.page)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
