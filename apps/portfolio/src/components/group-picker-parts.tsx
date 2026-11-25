import { FolderOpen, type LucideIcon, Shapes, Tag } from "lucide-react";
import { useState } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { EmptyNote } from "@portfolio/components/empty-note";
import { GroupListControls, groupSorts } from "@portfolio/components/group-list-controls";
import { HiddenNote } from "@portfolio/components/hidden-note";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import {
  albumOptions,
  type FilterOption,
  genreOptions,
  tagOptions,
} from "@portfolio/lib/filter-options";
import { type GroupRow, searchAndSortGroups } from "@portfolio/lib/group-list";
import { filterPhotos, type PhotoFilters, withoutFilters } from "@portfolio/lib/photo-filters";
import type { Photo } from "@portfolio/lib/photos";

/** The filters the Groups picker sets: the album, the tag and the genre. */
type GroupKey = "album" | "tag" | "genre";

/** What the Groups picker reads and changes, and the photos its counts are out of. */
export interface GroupPickerProps {
  facet: Photo[];
  filters: PhotoFilters;
  setFilters: (next: PhotoFilters) => void;
}

/** One section of the Groups picker, with its choices and the one chosen. */
export interface GroupSection {
  key: GroupKey;
  /** Its name in the list, such as "Albums". */
  label: string;
  /** What its first choice, which clears it, is called, such as "All albums". */
  all: string;
  Icon: LucideIcon;
  /** Its choices, each counting the photos the other filters leave. */
  options: FilterOption[];
  /** The choice the filters make, if any. */
  chosen?: FilterOption;
  /** The chosen one's name in the Script Display's writing, or undefined while none is. */
  chosenText?: string;
}

/** Each section's name, icon and choices, in the order the list shows them. */
const SECTIONS: {
  key: GroupKey;
  label: string;
  all: string;
  Icon: LucideIcon;
  list: (facet: Photo[]) => FilterOption[];
}[] = [
  { key: "album", label: "Albums", all: "All albums", Icon: FolderOpen, list: albumOptions },
  { key: "tag", label: "Tags", all: "All tags", Icon: Tag, list: tagOptions },
  { key: "genre", label: "Genres", all: "All genres", Icon: Shapes, list: genreOptions },
];

/**
 * The picker's sections, each choice counting what the other filters leave. Tags and Genres are
 * left out while there are none; Albums always shows.
 */
export function useSections({ facet, filters }: GroupPickerProps): GroupSection[] {
  const { script } = useScriptDisplay();
  return SECTIONS.flatMap(({ list, ...section }) => {
    const options = list(filterPhotos(facet, withoutFilters(filters, [section.key])));
    if (options.length === 0 && section.key !== "album") return [];
    const chosen = options.find((option) => filters[section.key] === option.value);
    return [{ ...section, options, chosen, chosenText: chosen?.label[script] }];
  });
}

/**
 * The right side of the Groups picker: a search box and **Sort** menu, then every choice of the
 * section, indented under its parent, with how many photos each would show; clicking the chosen
 * one again goes back to all. Choices that would show no photos, given the other filters, are left
 * out, unless chosen. While searching, a parent that doesn't match is dimmed above its matches.
 */
export function GroupPickerPart({
  section,
  filters,
  setFilters,
}: GroupPickerProps & { section: GroupSection }) {
  const sorts = groupSorts(section.key);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sorts[0]?.[0] ?? "set");
  const shown = section.options.filter((option) => option.count > 0 || option === section.chosen);
  const rows = searchAndSortGroups(shown, sort, query);
  const noun = section.label.toLowerCase();
  const choose = (value?: string) => setFilters({ ...filters, [section.key]: value });
  return (
    <div className="flex flex-col">
      <GroupListControls
        noun={noun}
        query={query}
        onQuery={setQuery}
        sorts={sorts}
        sort={sort}
        onSort={setSort}
      />
      <ChoiceRow label={section.all} on={!section.chosen} onClick={() => choose()} />
      <GroupRows rows={rows} section={section} choose={choose} />
      <NoMatch shown={rows.length} noun={noun} query={query} />
      <HiddenNote count={section.options.length - shown.length} noun="choices" />
    </div>
  );
}

/** The searched and sorted choices, a parent there only for context dimmed. */
function GroupRows({
  rows,
  section,
  choose,
}: {
  rows: GroupRow[];
  section: GroupSection;
  choose: (value?: string) => void;
}) {
  const { script } = useScriptDisplay();
  return rows.map(({ option, context }, index) => (
    <ChoiceRow
      key={`${index}-${option.value}`}
      label={option.label[script]}
      count={option.count}
      depth={option.depth}
      on={option === section.chosen}
      dimmed={context}
      onClick={() => choose(option === section.chosen ? undefined : option.value)}
    />
  ));
}

/** Says nothing matches the search, while there's search text and no rows are left. */
function NoMatch({ shown, noun, query }: { shown: number; noun: string; query: string }) {
  const text = query.trim();
  if (shown > 0 || !text) return null;
  return (
    <EmptyNote className="px-2 pt-2">
      No {noun} match “{text}”.
    </EmptyNote>
  );
}
