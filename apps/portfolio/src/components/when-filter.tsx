import { useLocation } from "@tanstack/react-router";
import { CalendarClock, ChevronsUpDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { RangeFilter } from "@portfolio/components/range-filter";
import type { RangePreset } from "@portfolio/components/range-presets";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import {
  ChoiceRow,
  SeasonMonthGrid,
  ToggleButton,
  WhenHeading,
} from "@portfolio/components/when-buttons";
import { filterPhotos, type PhotoFilters, withoutFilters } from "@portfolio/lib/photo-filters";
import { photos as allPhotos, type Photo } from "@portfolio/lib/photos";
import { QUICK_DATES, quickDateDetail, inQuickDate } from "@portfolio/lib/quick-dates";
import { hourEnd, hourStart, photoHours } from "@portfolio/lib/time-of-day";
import { cn } from "@portfolio/lib/utils";
import {
  DAYPARTS,
  daypartRange,
  daypartSpan,
  dayOf,
  DATE_KEYS,
  hasDateRange,
  SEASONS,
  TIME_KEY,
  WEEKDAYS,
  whenCount,
} from "@portfolio/lib/when-filters";

/** The hours slider's steps: every hour of the day a portfolio photo was taken in. */
const HOUR_VALUES = photoHours(allPhotos);

/** The parts of the day as the hours slider's quick picks, leaving out ones no photo is in. */
const DAYPART_PRESETS: RangePreset[] = DAYPARTS.flatMap((daypart) => {
  const range = daypartRange(daypart, HOUR_VALUES);
  return range ? [{ id: daypart.id, name: daypart.label, span: daypartSpan(daypart), range }] : [];
});

/** The first and last day a portfolio photo was taken, for the date range's inputs. */
const DAYS = allPhotos.map((photo) => dayOf(photo.takenAt)).toSorted();

/** The ways the When picker chooses dates: in every year, recently in earlier years, or a range. */
type DateMode = "years" | "quick" | "range";

/** The filters each way of choosing dates sets, which choosing another way clears. */
const MODE_KEYS = { years: ["month"], quick: ["when"], range: DATE_KEYS } as const;

/** Every way's keys but the mode's, so choosing in one clears the others. */
function otherModeKeys(mode: DateMode) {
  return (Object.keys(MODE_KEYS) as DateMode[])
    .filter((m) => m !== mode)
    .flatMap((m) => MODE_KEYS[m]);
}

/** The way the filters choose dates, to open the picker on. */
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

/**
 * A **When** button that opens one picker for when photos were taken: the dates (the seasons with
 * their months under them, in any year; this date, month or season in earlier years; or a range of
 * dates), then the days of the week and the hours, with the parts of the day as quick picks. The
 * Timeline has its own range and Quick dates, so there it only picks across every year.
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
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-4 p-3"
      >
        <DatesPart {...props} onlyYears={onTimeline} />
        <DaysPart {...props} />
        <HoursPart {...props} />
      </PopoverContent>
    </Popover>
  );
}

/** The photos the facet leaves with the filters but the ones named. */
function countedOut(facet: Photo[], filters: PhotoFilters, keys: readonly string[]): Photo[] {
  return filterPhotos(facet, withoutFilters(filters, keys as Parameters<typeof withoutFilters>[1]));
}

const MODE_LABELS: [DateMode, string][] = [
  ["years", "Across all years"],
  ["quick", "Previous years"],
  ["range", "Date range"],
];

/** The part of the picker for each way of choosing dates. */
const MODE_PARTS: Record<DateMode, (props: WhenProps) => ReactNode> = {
  years: (props) => <YearsPart {...props} />,
  quick: (props) => <QuickPart {...props} />,
  range: (props) => <RangePart {...props} />,
};

/** The dates: a tab for each way of choosing them, unless `onlyYears`, which keeps to across all years. */
function DatesPart({ onlyYears, ...props }: WhenProps & { onlyYears: boolean }) {
  const [mode, setMode] = useState<DateMode>(() => (onlyYears ? "years" : modeOf(props.filters)));
  return (
    <section className="flex flex-col gap-2">
      {!onlyYears && <DateTabs mode={mode} onChange={setMode} />}
      {MODE_PARTS[mode](props)}
    </section>
  );
}

/** The tabs for the ways of choosing dates. */
function DateTabs({ mode, onChange }: { mode: DateMode; onChange: (mode: DateMode) => void }) {
  return (
    <div role="tablist" aria-label="Dates" className="flex rounded-md border bg-muted/50 p-0.5">
      {MODE_LABELS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "flex-1 rounded-sm px-1.5 py-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            mode === value && "bg-background text-foreground shadow-xs",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Sets the mode's filters, clearing the other ways of choosing dates. */
function setInMode(props: WhenSetters, mode: DateMode, next: PhotoFilters) {
  props.setFilters({
    ...withoutFilters(props.filters, [...otherModeKeys(mode), ...MODE_KEYS[mode]]),
    ...next,
  });
}

/** The seasons with their months, in any year. */
function YearsPart(props: WhenProps) {
  return (
    <>
      <WhenHeading>Time of year</WhenHeading>
      <SeasonMonthGrid
        seasons={SEASONS}
        photos={countedOut(props.facet, props.filters, ["month", ...otherModeKeys("years")])}
        chosen={props.filters.month ?? []}
        onChange={(month) => setInMode(props, "years", month.length > 0 ? { month } : {})}
      />
    </>
  );
}

/** This date, month or season, in the years before this one. */
function QuickPart(props: WhenProps) {
  const [now] = useState(() => new Date());
  const counted = countedOut(props.facet, props.filters, ["when", ...otherModeKeys("quick")]);
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
            onClick={() =>
              setInMode(props, "quick", props.filters.when === value ? {} : { when: value })
            }
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
    setInMode(props, "range", Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
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

/** The days of the week, Monday first. */
function DaysPart(props: WhenProps) {
  return (
    <section className="flex flex-col gap-2">
      <WhenHeading>Days</WhenHeading>
      <ChoiceRow
        choices={WEEKDAYS}
        photos={countedOut(props.facet, props.filters, ["weekday"])}
        chosen={props.filters.weekday ?? []}
        onChange={(weekday) =>
          props.setFilters({
            ...withoutFilters(props.filters, ["weekday"]),
            ...(weekday.length > 0 ? { weekday } : {}),
          })
        }
      />
    </section>
  );
}

/** The hours slider, with the parts of the day as quick picks. */
function HoursPart(props: WhenSetters) {
  return (
    <RangeFilter
      label="Hours"
      values={HOUR_VALUES}
      range={props.filters[TIME_KEY]}
      write={hourStart}
      writeHigh={hourEnd}
      presets={DAYPART_PRESETS}
      onChange={(time) =>
        props.setFilters({
          ...withoutFilters(props.filters, [TIME_KEY]),
          ...(time ? { time } : {}),
        })
      }
    />
  );
}
