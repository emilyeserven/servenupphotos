import { FilePenLineIcon } from "lucide-react";
import type { ReactNode } from "react";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";
import { cn } from "@/lib/utils";

/** What a draft is, for the mark's tooltip. */
const DRAFT_HELP =
  "No title yet, so Commit leaves it out of ALLPHOTOS.json and the portfolio doesn't show it. Give it a title to publish it.";

/**
 * "Draft" when the photo's JSON has no title and untitled photos are kept as drafts (see Settings);
 * otherwise `children`, such as whether it's in ALLPHOTOS.json, or nothing.
 */
export function DraftMark({
  data,
  className,
  children,
}: {
  data: unknown;
  className?: string;
  children?: ReactNode;
}) {
  const drafts = useUntitledDrafts();
  if (!drafts || !isDraft(data)) return children;
  return (
    <span
      title={DRAFT_HELP}
      className={cn(
        "flex w-fit items-center gap-1 text-xs font-normal text-violet-700 dark:text-violet-400",
        className,
      )}
    >
      <FilePenLineIcon className="size-3.5" aria-hidden />
      Draft, not on the portfolio
    </span>
  );
}

/** A small "Draft" label for a photo tile under the same rule as `DraftMark`, or else `children`. */
export function DraftBadge({
  data,
  className,
  children,
}: {
  data: unknown;
  className: string;
  children?: ReactNode;
}) {
  const drafts = useUntitledDrafts();
  if (!drafts || !isDraft(data)) return children;
  return (
    <span title={DRAFT_HELP} className={className}>
      Draft
    </span>
  );
}
