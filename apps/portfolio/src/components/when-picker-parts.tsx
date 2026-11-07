import { type ReactNode, useState } from "react";
import { DateField } from "@portfolio/components/date-field";
import { PickerPart } from "@portfolio/components/section-picker";
import {
  ChoiceGrid,
  HourRows,
  MonthColumns,
  ToggleButton,
} from "@portfolio/components/when-buttons";
import { filterPhotos, type PhotoFilters, withoutFilters } from "@portfolio/lib/photo-filters";
import { photos as allPhotos, type Photo } from "@portfolio/lib/photos";
import {
  CURRENT_LABELS,
  currentChoice,
  DAYPARTS,
  dayOf,
  type ListKey,
  SEASONS,
  WEEKDAYS,
  WHEN_KEYS,
} from "@portfolio/lib/when-filters";

/** The first and last day a portfolio photo was taken, which the calendar keeps to. */
const FIRST_DAY = new Date(Math.min(...allPhotos.map((photo) => photo.takenAt.getTime())));
const LAST_DAY = new Date(Math.max(...allPhotos.map((photo) => photo.takenAt.getTime())));

/** One section of the When picker: a kind of list across all years, or a range of dates. */
export type WhenSection = ListKey | "range";

/** The filters the When picker reads and changes. */
export interface WhenSetters {
  filters: PhotoFilters;
  setFilters: (next: PhotoFilters) => void;
}

/** What the When picker reads and changes, and the photos each choice's count is out of. */
export interface WhenProps extends WhenSetters {
  facet: Photo[];
}

/** Sets one "when" filter, clearing the others: the picker chooses one way at a time. */
function setWhen({ filters, setFilters }: WhenSetters, next: PhotoFilters) {
  setFilters({ ...withoutFilters(filters, WHEN_KEYS), ...next });
}

/** The right side of the When picker: the chosen section's buttons, or the date range's fields. */
export function WhenPickerPart({ section, ...props }: WhenProps & { section: WhenSection }) {
  if (section === "range") return <RangePart {...props} />;
  return <ListPart kind={section} {...props} />;
}

/** What each kind of list is for, over its buttons. */
const INTROS: Record<ListKey, string> = {
  season: "The photos taken in any of the picked seasons, in any year. Spring is March to May.",
  month: "The photos taken in any of the picked months, in any year.",
  weekday: "The photos taken on any of the picked days of the week.",
  hour: "The photos taken in any of the picked hours, by the clock where each was taken. A part of the day's name picks all its hours.",
};

/** The grid of toggles for each kind of list. */
const KIND_GRIDS: Record<
  ListKey,
  (props: { photos: Photo[]; chosen: string[]; onChange: (v: string[]) => void }) => ReactNode
> = {
  season: (props) => <ChoiceGrid choices={SEASONS} columns="grid-cols-4" {...props} />,
  month: (props) => <MonthColumns seasons={SEASONS} {...props} />,
  weekday: (props) => <ChoiceGrid choices={WEEKDAYS} columns="grid-cols-7" {...props} />,
  hour: (props) => <HourRows dayparts={DAYPARTS} {...props} />,
};

/**
 * Seasons, months, days of the week or hours, in any year: a button for the one it is now, then
 * any number of the kind to choose, each counting the photos the other filters leave. Choosing
 * here clears any other "when" filter.
 */
function ListPart({ kind, ...props }: WhenProps & { kind: ListKey }) {
  const photos = filterPhotos(props.facet, withoutFilters(props.filters, WHEN_KEYS));
  const chosen = props.filters[kind] ?? [];
  const onChange = (values: string[]) =>
    setWhen(props, values.length > 0 ? { [kind]: values } : {});
  return (
    <PickerPart intro={INTROS[kind]}>
      <CurrentButton kind={kind} photos={photos} chosen={chosen} onChange={onChange} />
      {KIND_GRIDS[kind]({ photos, chosen, onChange })}
    </PickerPart>
  );
}

/**
 * A button for the season, month, day of the week or hour it is now, such as "This season ·
 * Autumn": it chooses just that one, or clears it when it's the only one chosen.
 */
function CurrentButton({
  kind,
  photos,
  chosen,
  onChange,
}: {
  kind: ListKey;
  photos: Photo[];
  chosen: string[];
  onChange: (values: string[]) => void;
}) {
  const [now] = useState(() => new Date());
  const current = currentChoice(kind, now);
  const on = chosen.length === 1 && chosen[0] === current.value;
  return (
    <ToggleButton
      label={`${CURRENT_LABELS[kind]} · ${current.label}`}
      count={photos.filter(current.matches).length}
      on={on}
      onClick={() => onChange(on ? [] : [current.value])}
    />
  );
}

/** A day as YYYY-MM-DD, or undefined without one. */
function dayText(date: Date | undefined): string | undefined {
  return date ? dayOf(date) : undefined;
}

/** A YYYY-MM-DD day as a date, or undefined without one. */
export function dateOf(day: string | undefined): Date | undefined {
  return day ? new Date(`${day}T00:00`) : undefined;
}

/**
 * A range of dates from the first day to the last, both included, each picked in its own field with
 * its own calendar; either can be left open. The start can't come after the end.
 */
function RangePart(props: WhenSetters) {
  const from = dateOf(props.filters.start);
  const to = dateOf(props.filters.end);
  const set = (next: { start?: Date; end?: Date }) => {
    const days = { start: dayText(next.start), end: dayText(next.end) };
    setWhen(props, Object.fromEntries(Object.entries(days).filter(([, day]) => day)));
  };
  return (
    <PickerPart intro="The photos taken from the first day to the last, both included. Either end can be left open.">
      <div className="grid grid-cols-2 gap-2">
        <DateField
          label="From"
          value={from}
          onChange={(start) => set({ start, end: to })}
          first={FIRST_DAY}
          last={LAST_DAY}
          disabled={to && { after: to }}
        />
        <DateField
          label="To"
          value={to}
          onChange={(end) => set({ start: from, end })}
          first={FIRST_DAY}
          last={LAST_DAY}
          disabled={from && { before: from }}
        />
      </div>
    </PickerPart>
  );
}
