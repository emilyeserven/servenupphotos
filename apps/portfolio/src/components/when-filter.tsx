import { useLocation } from "@tanstack/react-router";
import { CalendarClock, ChevronsUpDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@portfolio/components/ui/button";
import { Calendar } from "@portfolio/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import {
  ChoiceGrid,
  HourRows,
  MonthColumns,
  ToggleButton,
} from "@portfolio/components/when-buttons";
import { filterPhotos, type PhotoFilters, withoutFilters } from "@portfolio/lib/photo-filters";
import { photos as allPhotos, type Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";
import {
  CURRENT_LABELS,
  currentChoice,
  DAYPARTS,
  dayOf,
  hasDateRange,
  LIST_KEYS,
  type ListKey,
  SEASONS,
  WEEKDAYS,
  WHEN_KEYS,
  whenCount,
} from "@portfolio/lib/when-filters";

/** The first and last day a portfolio photo was taken, which the calendar keeps to. */
const FIRST_DAY = new Date(Math.min(...allPhotos.map((photo) => photo.takenAt.getTime())));
const LAST_DAY = new Date(Math.max(...allPhotos.map((photo) => photo.takenAt.getTime())));

/** The ways the When picker chooses: across all years, or a range of dates. */
type DateMode = "years" | "range";

/** The way the filters choose, to open the picker on. */
function modeOf(filters: PhotoFilters): DateMode {
  return hasDateRange(filters) ? "range" : "years";
}

/** The filters the When picker reads and changes. */
interface WhenSetters {
  filters: PhotoFilters;
  setFilters: (next: PhotoFilters) => void;
}

/** What the When picker reads and changes, and the photos each choice's count is out of. */
interface WhenProps extends WhenSetters {
  facet: Photo[];
}

/** Sets one "when" filter, clearing the others: the picker chooses one way at a time. */
function setWhen({ filters, setFilters }: WhenSetters, next: PhotoFilters) {
  setFilters({ ...withoutFilters(filters, WHEN_KEYS), ...next });
}

/** The photos the facet leaves with the other filters, but no "when" filter. */
function countedOut({ facet, filters }: WhenProps): Photo[] {
  return filterPhotos(facet, withoutFilters(filters, WHEN_KEYS));
}

/**
 * A **When** button that opens one picker for when photos were taken, one way at a time: across
 * all years (seasons, months, days of the week or hours, any number of one kind, with the current
 * one a click away), or a range of dates on a calendar. The Timeline has its own time range, so
 * there it only picks across all years.
 */
export function WhenFilter({ facet, filters, setFilters }: WhenProps) {
  const props = { facet, filters, setFilters };
  const count = whenCount(filters);
  const onTimeline = useLocation().pathname === "/timeline";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <CalendarClock className="text-muted-foreground" aria-hidden />
          When
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {count}
            </span>
          )}
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 p-3"
      >
        <ModeParts {...props} onlyYears={onTimeline} />
      </PopoverContent>
    </Popover>
  );
}

const MODE_LABELS: [DateMode, string][] = [
  ["years", "Across all years"],
  ["range", "Date range"],
];

/** The part of the picker for each way of choosing. */
const MODE_PARTS: Record<DateMode, (props: WhenProps) => ReactNode> = {
  years: (props) => <YearsPart {...props} />,
  range: (props) => <RangePart {...props} />,
};

/** A tab for each way of choosing, unless `onlyYears`, which keeps to across all years. */
function ModeParts({ onlyYears, ...props }: WhenProps & { onlyYears: boolean }) {
  const [mode, setMode] = useState<DateMode>(() => (onlyYears ? "years" : modeOf(props.filters)));
  return (
    <>
      {!onlyYears && <Tabs label="When" options={MODE_LABELS} value={mode} onChange={setMode} />}
      {MODE_PARTS[mode](props)}
    </>
  );
}

/** A row of tabs, the chosen one raised. */
function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-md border bg-muted/50 p-0.5">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "flex-1 rounded-sm px-1.5 py-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === option && "bg-background text-foreground shadow-xs",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const KIND_LABELS: [ListKey, string][] = [
  ["season", "Seasons"],
  ["month", "Months"],
  ["weekday", "Days"],
  ["hour", "Hours"],
];

/** The kind of list the filters choose from, or seasons when none is set. */
function kindOf(filters: PhotoFilters): ListKey {
  return LIST_KEYS.find((key) => (filters[key]?.length ?? 0) > 0) ?? "season";
}

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
 * Seasons, months, days of the week or hours, in any year: a tab for each kind, a button for the
 * one it is now, and any number of one kind chosen. Choosing another kind clears the first.
 */
function YearsPart(props: WhenProps) {
  const [kind, setKind] = useState<ListKey>(() => kindOf(props.filters));
  const photos = countedOut(props);
  const chosen = props.filters[kind] ?? [];
  const onChange = (values: string[]) =>
    setWhen(props, values.length > 0 ? { [kind]: values } : {});
  return (
    <>
      <Tabs label="Across all years" options={KIND_LABELS} value={kind} onChange={setKind} />
      <CurrentButton kind={kind} photos={photos} chosen={chosen} onChange={onChange} />
      {KIND_GRIDS[kind]({ photos, chosen, onChange })}
    </>
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
function dateOf(day: string | undefined): Date | undefined {
  return day ? new Date(`${day}T00:00`) : undefined;
}

/**
 * A range of dates on a calendar, from the first day to the last, both included: the first click
 * sets the start, the second the end. It opens on the start's month, or the latest photo's.
 */
function RangePart(props: WhenSetters) {
  const from = dateOf(props.filters.start);
  const to = dateOf(props.filters.end);
  return (
    <Calendar
      mode="range"
      defaultMonth={from ?? LAST_DAY}
      selected={from ? { from, to } : undefined}
      onSelect={(range) => {
        const next = { start: dayText(range?.from), end: dayText(range?.to) };
        setWhen(props, Object.fromEntries(Object.entries(next).filter(([, day]) => day)));
      }}
      startMonth={FIRST_DAY}
      endMonth={LAST_DAY}
      className="mx-auto bg-transparent p-0"
    />
  );
}
