import { ArrowUpDown, Search } from "lucide-react";
import { PickMenu } from "@portfolio/components/pick-menu";
import type { GroupSort } from "@portfolio/lib/group-list";

/** The Tags and Likes lists' sorts, A to Z first as it's how the tags and people are kept. */
const TAG_SORTS: [GroupSort, string][] = [
  ["az", "A to Z"],
  ["za", "Z to A"],
  ["most", "Most photos"],
  ["fewest", "Fewest photos"],
];

/** The Albums and Genres lists' sorts, their own set order first. */
const SET_SORTS: [GroupSort, string][] = [
  ["set", "Set order"],
  ["az", "A to Z"],
  ["za", "Z to A"],
  ["most", "Most photos"],
  ["fewest", "Fewest photos"],
];

/**
 * The sorts a Groups list offers, its default first: A to Z for tags and people, the set order
 * for albums and genres.
 */
export function groupSorts(key: "album" | "tag" | "genre" | "liked"): [GroupSort, string][] {
  return key === "tag" || key === "liked" ? TAG_SORTS : SET_SORTS;
}

/**
 * The top row of an album, tag or genre list in the Groups picker: a search box that narrows the
 * list to the names with its text, and the **Sort** menu. It stays at the top while the list scrolls.
 */
export function GroupListControls({
  noun,
  query,
  onQuery,
  sorts,
  sort,
  onSort,
}: {
  /** What the list holds, such as "tags", for the search box's placeholder. */
  noun: string;
  query: string;
  onQuery: (query: string) => void;
  sorts: [GroupSort, string][];
  sort: GroupSort;
  onSort: (sort: GroupSort) => void;
}) {
  return (
    <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-1 flex items-center gap-1 border-b bg-popover px-3 py-1.5">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search {noun}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={`Search ${noun}…`}
          className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <PickMenu label="Sort" Icon={ArrowUpDown} options={sorts} value={sort} onChange={onSort} />
    </div>
  );
}
