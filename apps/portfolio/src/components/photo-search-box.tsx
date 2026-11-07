import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { parseTextSearch, TEXT_SEARCH_KEY } from "@portfolio/lib/text-search";

/**
 * The Grid's and Timeline's search box, which narrows the photos to ones with the text in their
 * title, location or camera model. What's typed goes in the URL (`?q=`) as it's typed, replacing
 * the page's history entry rather than adding one per letter.
 */
export function PhotoSearchBox() {
  const query = parseTextSearch(useSearch({ strict: false })).q ?? "";
  const navigate = useNavigate();
  const [text, setText] = useState(query);
  const [shownQuery, setShownQuery] = useState(query);
  // When the URL changes some other way, such as Clear filters, the box shows what it says now.
  if (query !== shownQuery) {
    setShownQuery(query);
    setText(query);
  }

  /** Shows what's typed and searches for it. */
  function change(next: string) {
    setText(next);
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        [TEXT_SEARCH_KEY]: next || undefined,
      }),
    });
  }

  return (
    <label className="relative flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2.5 shadow-xs focus-within:ring-2 focus-within:ring-ring sm:w-64 dark:border-input dark:bg-input/30">
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">Search photos by title, location or camera</span>
      <input
        type="text"
        value={text}
        onChange={(event) => change(event.target.value)}
        placeholder="Search title, place, camera…"
        className="w-full bg-transparent pr-5 text-sm outline-none placeholder:text-muted-foreground"
      />
      {text && (
        <ClearFilterButton label="search" onClear={() => change("")} className="absolute right-2" />
      )}
    </label>
  );
}
