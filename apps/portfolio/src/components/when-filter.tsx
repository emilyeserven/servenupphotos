import { useLocation } from "@tanstack/react-router";
import { CalendarClock, ChevronsUpDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import {
  ChoiceGrid,
  HourRows,
  MonthColumns,
  ToggleButton,
  WhenHeading,
} from "@portfolio/components/when-buttons";
import { filterPhotos, type PhotoFilters, withoutFilters } from "@portfolio/lib/photo-filters";
import { photos as allPhotos, type Photo } from "@portfolio/lib/photos";
import { QUICK_DATES, quickDateDetail, inQuickDate } from "@portfolio/lib/quick-dates";
import { cn } from "@portfolio/lib/utils";
import {
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

/** The first and last day a portfolio photo was taken, for the date range's inputs. */
const DAYS = allPhotos.map((photo) => dayOf(photo.takenAt)).toSorted();

/** The ways the When picker chooses: in every year, recently in earlier years, or a range of dates. */
type DateMode = "years" | "quick" | "range";

/** The way the filters choose, to open the picker on. */
function modeOf(filters: PhotoFilters): DateMode {
  if (filters.when) return "quick";
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
 * all years (seasons, months, days of the week or hours, any number of one kind), this date, month
 * or season in earlier years, or a range of dates. The Timeline has its own range and Quick dates,
 * so there it only picks across all years.
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
  ["quick", "Previous years"],
  ["range", "Date range"],
];

/** The part of the picker for each way of choosing. */
const MODE_PARTS: Record<DateMode, (props: WhenProps) => ReactNode> = {
  years: (props) => <YearsPart {...props} />,
  quick: (props) => <QuickPart {...props} />,
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
 * Seasons, months, days of the week or hours, in any year: a tab for each kind, and any number of
 * one kind chosen. Choosing another kind clears the first.
 */
function YearsPart(props: WhenProps) {
  const [kind, setKind] = useState<ListKey>(() => kindOf(props.filters));
  return (
    <>
      <Tabs label="Across all years" options={KIND_LABELS} value={kind} onChange={setKind} />
      {KIND_GRIDS[kind]({
        photos: countedOut(props),
        chosen: props.filters[kind] ?? [],
        onChange: (values) => setWhen(props, values.length > 0 ? { [kind]: values } : {}),
      })}
    </>
  );
}

/** This date, month or season, in the years before this one. */
function QuickPart(props: WhenProps) {
  const [now] = useState(() => new Date());
  const counted = countedOut(props);
  return (
    <>
      <WhenHeading>This time, previous years</WhenHeading>
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_DATES.map(({ value, label }) => (
          <ToggleButton
            key={value}
            label={`${label} · ${quickDateDetail(value, now)}`}
            count={counted.filter((photo) => inQuickDate(photo.takenAt, value, now)).length}
            on={props.filters.when === value}
            onClick={() => setWhen(props, props.filters.when === value ? {} : { when: value })}
          />
        ))}
      </div>
    </>
  );
}

/** A range of dates, from the first day to the last, both included. */
function RangePart(props: WhenSetters) {
  const { start, end } = props.filters;
  /** Sets one end, keeping the other. */
  function setEnd(key: "start" | "end", value: string) {
    const next = { start, end, [key]: value || undefined };
    setWhen(props, Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  }
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {(["start", "end"] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1 font-medium text-muted-foreground">
          {key === "start" ? "From" : "To"}
          <input
            type="date"
            value={props.filters[key] ?? ""}
            min={DAYS[0]}
            max={DAYS.at(-1)}
            onChange={(event) => setEnd(key, event.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground dark:bg-input/30"
          />
        </label>
      ))}
    </div>
  );
}
