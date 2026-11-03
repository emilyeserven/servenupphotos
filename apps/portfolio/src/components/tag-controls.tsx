import { Link } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowDownWideNarrow, ListTree, Network, Rows3 } from "lucide-react";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import type { TagSort } from "@/lib/tag-list";

/** The Tags page's settings, kept in the URL; each is left out at its default. */
export interface TagsSearch {
  /** Left out for by name. */
  sort?: Exclude<TagSort, "name">;
  /** True to show only the top-level tags, without the tags under them. */
  top?: true;
}

/** The Tags page's settings from the URL, leaving out anything else. */
export function parseTagsSearch(search: Record<string, unknown>): TagsSearch {
  return {
    ...(isOtherSort(search.sort) ? { sort: search.sort } : {}),
    ...(search.top === true ? { top: true } : {}),
  };
}

/** Whether the value is a sort other than the default, by name. */
function isOtherSort(value: unknown): value is Exclude<TagSort, "name"> {
  return value === "count" || value === "subtags";
}

const SORTS = [
  { value: "name", label: "A–Z", Icon: ArrowDownAZ },
  { value: "count", label: "Most photos", Icon: ArrowDownWideNarrow },
  { value: "subtags", label: "Most subtags", Icon: Network },
] as const;

const SHOWN = [
  { top: false, label: "All tags", Icon: ListTree },
  { top: true, label: "Top level only", Icon: Rows3 },
] as const;

/**
 * Two rows of buttons above the tags: sorting them by name, by how many photos they have or by how
 * many tags are under them, and
 * showing every tag under its parent or only the top-level ones.
 */
export function TagControls({ sort, top }: { sort: TagSort; top: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <div role="group" aria-label="Sort tags" className={CONTROL_FRAME}>
        {SORTS.map(({ value, label, Icon }) => (
          <Link
            key={value}
            from="/tags"
            to="/tags"
            search={(prev) => ({ ...prev, sort: isOtherSort(value) ? value : undefined })}
            replace
            aria-pressed={sort === value}
            className={controlButtonClass(sort === value)}
          >
            <Icon aria-hidden />
            {label}
          </Link>
        ))}
      </div>
      <div role="group" aria-label="Show tags" className={CONTROL_FRAME}>
        {SHOWN.map((option) => (
          <Link
            key={option.label}
            from="/tags"
            to="/tags"
            search={(prev) => ({ ...prev, top: option.top || undefined })}
            replace
            aria-pressed={top === option.top}
            className={controlButtonClass(top === option.top)}
          >
            <option.Icon aria-hidden />
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
