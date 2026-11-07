import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A card that collapses to its title and a count, such as Photos in Flight's Drafts, Undecided and
 * Places panels. Closed at first unless `open`.
 */
export function CollapsiblePanel({
  title,
  count,
  open,
  children,
}: {
  title: ReactNode;
  /** What's in it, shown beside the title, such as "3 photos set aside". */
  count: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group/panel bg-card rounded-xl border shadow-sm">
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-6 py-4 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="text-muted-foreground size-4 transition-transform group-open/panel:rotate-90"
          aria-hidden
        />
        <span className="font-semibold">{title}</span>
        <span className="text-muted-foreground text-sm">{count}</span>
      </summary>
      <div className="flex flex-col gap-4 px-6 pb-6">{children}</div>
    </details>
  );
}

/** "1 photo" or "3 photos": n with the noun, plural unless n is 1. */
export function countOf(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}
