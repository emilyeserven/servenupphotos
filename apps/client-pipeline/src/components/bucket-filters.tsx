import { useNavigate } from "@tanstack/react-router";
import { FilterIcon, SearchIcon } from "lucide-react";
import { FilterResult, FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FilterChoice } from "@/lib/photo-filters";

/** Where a bucket photo's data is: in the open pull request, in ALLPHOTOS.json, or nowhere yet. */
export type PhotoState = "in-flight" | "saved" | "unsaved";

/** The Explore Bucket filters, kept in the URL; one left out isn't filtered on. */
export interface BucketFilters {
  /** Text the image's key has in it, ignoring case: `?q=dsc0001`. */
  q?: string;
  /** Where the photo's data is: `?data=unsaved`. */
  data?: PhotoState;
  /** Whether the original has resized copies in the bucket: `?copies=without`. */
  copies?: FilterChoice;
}

/** What the filters read about one tile of the grid: an original, or a copy on its own. */
export interface FilteredStack {
  key: string;
  /** How many resized copies are stacked behind it. */
  copyCount: number;
  /** Where its photo's data is, or undefined when that couldn't be checked. */
  state?: PhotoState;
}

const DATA_CHOICES: ToggleChoices<PhotoState> = [
  [undefined, "Any"],
  ["unsaved", "Not saved"],
  ["in-flight", "In flight"],
  ["saved", "Saved"],
];

const STATES = new Set<unknown>(["in-flight", "saved", "unsaved"]);

function isState(value: unknown): value is PhotoState {
  return STATES.has(value);
}

function isChoice(value: unknown): value is FilterChoice {
  return value === "with" || value === "without";
}

function parseText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The filters in Explore Bucket's search params, ignoring anything else. */
export function parseBucketFilters(search: Record<string, unknown>): BucketFilters {
  return {
    q: parseText(search.q),
    data: isState(search.data) ? search.data : undefined,
    copies: isChoice(search.copies) ? search.copies : undefined,
  };
}

/** Where a tile's photo data is, from its badges: in flight wins over saved. */
export function photoState(status: {
  inFlightPullRequest?: number;
  published: boolean;
}): PhotoState {
  if (status.inFlightPullRequest !== undefined) return "in-flight";
  return status.published ? "saved" : "unsaved";
}

/** Each filter's test, which passes everything while it's left out. */
const CHECKS: ((stack: FilteredStack, filters: BucketFilters) => boolean)[] = [
  (stack, { q }) => !q || stack.key.toLowerCase().includes(q.trim().toLowerCase()),
  (stack, { data }) => !data || stack.state === data,
  (stack, { copies }) => !copies || stack.copyCount > 0 === (copies === "with"),
];

/** Whether a tile passes every chosen filter. */
export function matchesBucketFilters(stack: FilteredStack, filters: BucketFilters): boolean {
  return CHECKS.every((check) => check(stack, filters));
}

function isChosen(filters: BucketFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}

interface BucketFilterBarProps {
  filters: BucketFilters;
  shown: number;
  total: number;
  /** Whether the photo data could be checked, so the Photo data filter can be offered. */
  stateKnown: boolean;
}

/**
 * Explore Bucket's filters: a search on the key, where the photo data is (once it's checked), and
 * whether an original has resized copies, with how many photos pass and Clear filters.
 */
export function BucketFilterBar({ filters, shown, total, stateKnown }: BucketFilterBarProps) {
  const navigate = useNavigate({ from: "/bucket" });
  const set = (next: BucketFilters) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  return (
    <CardContent className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <KeySearch value={filters.q ?? ""} onChange={(q) => set({ q: q || undefined })} />
        <FilterIcon className="text-muted-foreground size-4" aria-hidden />
        {stateKnown && (
          <FilterToggle
            label="Photo data"
            choice={filters.data}
            choices={DATA_CHOICES}
            onChange={(data) => set({ data })}
          />
        )}
        <FilterToggle
          label="Resized copies"
          choice={filters.copies}
          onChange={(copies) => set({ copies })}
        />
      </div>
      <FilterResult
        shown={shown}
        total={total}
        chosen={isChosen(filters)}
        onClear={() => set({ q: undefined, data: undefined, copies: undefined })}
      />
    </CardContent>
  );
}

function KeySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">Filter images by key</span>
      <SearchIcon
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        placeholder="Filter by key or file name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </label>
  );
}
