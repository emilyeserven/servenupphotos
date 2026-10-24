import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The photos in flight under a heading that collapses them, open at first, so the drafts and
 * Undecided panels below are a click away. Nothing when there are no photos to list.
 */
export function CollapsiblePhotos({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <details open className="group/photos flex flex-col">
      <summary className="hover:bg-muted/50 -mx-2 flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="text-muted-foreground size-4 transition-transform group-open/photos:rotate-90"
          aria-hidden
        />
        <span className="text-lg font-semibold">Photos in flight</span>
        <span className="text-muted-foreground text-sm">
          {count} {count === 1 ? "photo" : "photos"}
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-6">{children}</div>
    </details>
  );
}
