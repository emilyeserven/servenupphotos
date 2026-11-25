import { TriangleAlertIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { pageName } from "@/components/photo-book/page-types";
import type { PhotoBook } from "@/lib/photo-book";
import { PRINT_DPI, lowResolution } from "@/lib/photo-book-dpi";
import { photoName } from "@/lib/social-schedule";
import { usePrintResolutionStore } from "@/stores/print-resolution";
import { count } from "@portfolio/lib/words";

interface LowResolutionListProps {
  book: PhotoBook;
  photos: Map<string, SocialPhoto>;
  /** The page's printed width in inches; null for a page size in pixels, which isn't checked. */
  printWidth: number | null;
  /** Shows the page or spread with ID id in the preview. */
  onShow: (id: string) => void;
}

/**
 * Under the Book tab's preview: the photos in the book that print below 300 dpi in their places,
 * each naming its page and its resolution, to click to show that page; nothing when every photo
 * is sharp enough. A book sized in pixels says it can't be checked.
 */
export function LowResolutionList({ book, photos, printWidth, onShow }: LowResolutionListProps) {
  const places = usePrintResolutionStore((state) => state.places);
  if (printWidth === null) {
    return (
      <p className="text-muted-foreground mt-3 text-xs">
        The page size is in pixels, so the photos&apos; print resolution isn&apos;t checked. Give it
        in inches, centimeters, millimeters or points on the Info tab to check it.
      </p>
    );
  }
  const low = lowResolution(book, places);
  if (low.length === 0) return null;
  return (
    <section
      aria-label="Photos below 300 dpi"
      className="mt-3 flex flex-col gap-1.5 rounded-md border border-red-600/40 p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-medium">
        {/* oxlint-disable-next-line servenup/error-note -- a warning icon, not an error message */}
        <TriangleAlertIcon className="size-4 text-red-600" />
        {count(low.length, "photo")} below {PRINT_DPI} dpi
      </p>
      <p className="text-muted-foreground text-xs">
        They&apos;ll print soft at this page size. Give them a smaller place, or use a larger photo.
      </p>
      <ul className="flex flex-col">
        {low.map((item) => (
          <li key={`${item.page.id}-${item.photo}`}>
            <button
              type="button"
              onClick={() => onShow(item.unit)}
              className="hover:bg-accent flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-xs"
            >
              <span className="text-muted-foreground w-14 shrink-0">Page {item.number}</span>
              <span className="min-w-0 flex-1 truncate">
                {nameOf(photos, item.photo)} · {pageName(item.page)}
              </span>
              <span className="font-medium text-red-600 tabular-nums">{item.dpi} dpi</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The photo's title, or its file's path when it isn't in the photo files any more. */
function nameOf(photos: Map<string, SocialPhoto>, path: string): string {
  const photo = photos.get(path);
  return photo ? photoName(photo) : path;
}
