import { useState } from "react";
import { FilterSelect } from "@/components/photo-book/filter-select";
import { type LayoutOption, unitsInLayout } from "@/lib/photo-book-layout-filter";
import { type BookUnit, unitsTagged } from "@/lib/photo-book-order";

/** What the drawer's filters are set to, and setting them. */
interface DrawerFilterState {
  tag: string | null;
  onTag: (tag: string | null) => void;
  layout: string | null;
  onLayout: (layout: string | null) => void;
  showUsed: boolean;
  onShowUsed: (on: boolean) => void;
}

/**
 * The drawer's filters, by tag, by layout and whether to show the ones in the book (on to start),
 * and the pages and spreads they leave. A tag or layout no longer in use stops filtering.
 */
export function useDrawerFilters(
  units: BookUnit[],
  tags: string[],
  layouts: LayoutOption[],
  inBook: Set<string>,
) {
  const [pickedTag, onTag] = useState<string | null>(null);
  const [pickedLayout, onLayout] = useState<string | null>(null);
  const [showUsed, onShowUsed] = useState(true);
  const tagged = unitsTagged(units, tags, pickedTag);
  const laidOut = unitsInLayout(tagged.shown, layouts, pickedLayout);
  const listed = showUsed ? laidOut.shown : laidOut.shown.filter((unit) => !inBook.has(unit.id));
  const state: DrawerFilterState = {
    tag: tagged.filter,
    onTag,
    layout: laidOut.filter,
    onLayout,
    showUsed,
    onShowUsed,
  };
  return { listed, state };
}

/**
 * Beside the drawer's name: the tag and layout dropdowns (each left out when there's nothing to
 * pick) and **Show ones in the book**.
 */
export function DrawerFilters(
  props: { tags: string[]; layouts: LayoutOption[] } & { state: DrawerFilterState },
) {
  const { tags, layouts, state } = props;
  return (
    <>
      <FilterSelect
        label="Show pages tagged"
        all="All tags"
        options={tags.map((tag) => ({ value: tag, label: tag }))}
        value={state.tag}
        onChange={state.onTag}
      />
      <FilterSelect
        label="Show pages in layout"
        all="All layouts"
        options={layouts.map(({ id, label }) => ({ value: id, label }))}
        value={state.layout}
        onChange={state.onLayout}
      />
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          className="accent-primary size-3.5"
          checked={state.showUsed}
          onChange={(event) => state.onShowUsed(event.target.checked)}
        />
        Show ones in the book
      </label>
    </>
  );
}
