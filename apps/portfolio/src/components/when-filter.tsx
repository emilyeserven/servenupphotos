import { CalendarClock } from "lucide-react";
import { useState } from "react";
import {
  FilterPickerButton,
  PickerClear,
  type PickerSection,
  SectionPicker,
} from "@portfolio/components/section-picker";
import {
  dateOf,
  type WhenProps,
  type WhenSection,
  type WhenSetters,
  WhenPickerPart,
} from "@portfolio/components/when-picker-parts";
import { type PhotoFilters, withoutFilters } from "@portfolio/lib/photo-filters";
import {
  DAYPARTS,
  hasDateRange,
  type ListKey,
  MONTHS,
  SEASONS,
  WEEKDAYS,
  WHEN_KEYS,
  type WhenChoice,
  whenCount,
} from "@portfolio/lib/when-filters";

/** Each kind of list's name in the picker, what several chosen are called, and its choices. */
const KINDS: [ListKey, string, string, WhenChoice[]][] = [
  ["season", "Seasons", "seasons", SEASONS],
  ["month", "Months", "months", MONTHS],
  ["weekday", "Days", "days", WEEKDAYS],
  ["hour", "Hours", "hours", DAYPARTS.flatMap((part) => part.hours)],
];

/** What a kind of list is set to: "Any", the one or two chosen, such as "Spring, Autumn", or how many. */
function listText(chosen: string[], plural: string, choices: WhenChoice[]): string {
  if (chosen.length === 0) return "Any";
  if (chosen.length > 2) return `${chosen.length} ${plural}`;
  return choices
    .filter((choice) => chosen.includes(choice.value))
    .map((choice) => choice.label)
    .join(", ");
}

/** A day as the list shows it, such as "Mar 1, 2024", or "Any day" for an open end. */
function rangeDay(day: string | undefined): string {
  const date = dateOf(day);
  if (!date) return "Any day";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** What the date range is set to, such as "Mar 1, 2024 – Any day", or "Any". */
function rangeText(filters: PhotoFilters): string {
  if (!hasDateRange(filters)) return "Any";
  return `${rangeDay(filters.start)} – ${rangeDay(filters.end)}`;
}

/** The picker's sections: each kind of list, then the date range. */
function sectionsOf(filters: PhotoFilters): PickerSection<WhenSection>[] {
  const lists = KINDS.map(([key, label, plural, choices]) => {
    const chosen = filters[key] ?? [];
    return { key, label, set: chosen.length > 0, text: listText(chosen, plural, choices) };
  });
  const range = { key: "range" as const, label: "Date range", set: hasDateRange(filters) };
  return [...lists, { ...range, text: rangeText(filters) }];
}

/** The section to open the picker on: the one set, or the seasons when none is. */
function firstSection(filters: PhotoFilters): WhenSection {
  return sectionsOf(filters).find((section) => section.set)?.key ?? "season";
}

/**
 * A **When** button that opens one picker for when photos were taken, like **Gear & settings**: a
 * list of Seasons, Months, Days, Hours and Date range on the left, each saying what it's set to,
 * with **Clear when** under it, and the chosen one's choices on the right. It chooses one way at a
 * time: across all years (any number of seasons, months, days of the week or hours, with the
 * current one a click away), or a range of dates, which on the Timeline is the days it shows.
 */
export function WhenFilter(props: WhenProps) {
  return (
    <FilterPickerButton
      Icon={CalendarClock}
      label="When"
      count={whenCount(props.filters)}
      onClear={() => clearWhen(props)}
    >
      <PickerBody {...props} />
    </FilterPickerButton>
  );
}

/** The sections, opening on the one set, and the chosen one's choices. */
function PickerBody(props: WhenProps) {
  const [section, setSection] = useState(() => firstSection(props.filters));
  return (
    <SectionPicker
      label="When"
      sections={sectionsOf(props.filters)}
      chosen={section}
      onChoose={setSection}
      width="sm:w-[36rem]"
      footer={<ClearWhen {...props} />}
    >
      <WhenPickerPart section={section} {...props} />
    </SectionPicker>
  );
}

/** Clears every "when" filter. */
function clearWhen({ filters, setFilters }: WhenSetters) {
  setFilters(withoutFilters(filters, WHEN_KEYS));
}

/** **Clear when** under the list, clearing every "when" filter, shown while one is set. */
function ClearWhen(props: WhenSetters) {
  if (whenCount(props.filters) === 0) return null;
  return <PickerClear text="Clear when" label="When" onClear={() => clearWhen(props)} />;
}
