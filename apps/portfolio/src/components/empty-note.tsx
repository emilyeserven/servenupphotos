import type { ReactNode } from "react";
import { cn } from "@portfolio/lib/utils";

/**
 * The sentence every photo list shows when its filters or search leave none of its photos, in
 * the portfolio and the pipeline alike.
 */
export const NO_PHOTOS_MATCH = "No photos match these filters.";

/**
 * What a list, grid or panel shows when it has nothing in it: one muted, small sentence such as
 * "No albums yet." or {@link NO_PHOTOS_MATCH}, and what to do next when there is something to do.
 * Every empty state in both apps uses it, so they all look alike; `className` is for spacing and
 * placement only (padding, centering, a dashed border), never for its color or size.
 */
export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground text-sm", className)}>{children}</p>;
}
