import type { ReactNode } from "react";
import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";
import { type Season, seasonSpan, type WhenChoice } from "@portfolio/lib/when-filters";

/** A heading over one part of the When picker, such as Days. */
export function WhenHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-medium text-muted-foreground">{children}</h3>;
}

/** How a toggle looks: on, partly on, off with no photos, or off. */
type ToggleState = "on" | "partly" | "empty" | "off";

const STATE_CLASSES: Record<ToggleState, string> = {
  on: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  partly: "border-primary/60",
  empty: "opacity-40",
  off: "",
};

/** How a toggle looks, being on wins over being partly on, which wins over having no photos. */
function toggleState(on: boolean, partly: boolean, count: number): ToggleState {
  if (on) return "on";
  if (partly) return "partly";
  return count === 0 ? "empty" : "off";
}

/**
 * A button that turns a choice on or off, with its name over how many photos it would show; a
 * choice with none is dimmed, unless it's on.
 */
export function ToggleButton({
  label,
  title,
  count,
  on,
  partly = false,
  onClick,
}: {
  label: string;
  title?: string;
  count: number;
  on: boolean;
  /** Some of what it stands for is on, such as one month of a season. */
  partly?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center rounded-md border px-1 py-1 text-xs leading-tight outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        STATE_CLASSES[toggleState(on, partly, count)],
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/** How many of the photos each choice has. */
function countOf(photos: Photo[], choice: WhenChoice): number {
  return photos.filter(choice.matches).length;
}

/** The chosen values with the value turned on or off. */
function toggledValue(chosen: string[], value: string): string[] {
  return chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
}

/**
 * The chosen months with the season's turned on, or off when all three already are. A season is
 * a shortcut: only its months go in the URL.
 */
function toggledSeason(chosen: string[], { months }: Season): string[] {
  const values = months.map((month) => month.value);
  const all = values.every((value) => chosen.includes(value));
  const rest = chosen.filter((value) => !values.includes(value));
  return all ? rest : [...rest, ...values];
}

/**
 * The seasons as four columns, each with its months under it, as toggles: a month turns on or off,
 * and a season turns its three months on, or off once they all are. `photos` are what the counts
 * are out of.
 */
export function SeasonMonthGrid({
  seasons,
  photos,
  chosen,
  onChange,
}: {
  seasons: Season[];
  photos: Photo[];
  chosen: string[];
  onChange: (months: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {seasons.map((season) => {
        const on = season.months.filter((month) => chosen.includes(month.value)).length;
        return (
          <div key={season.value} className="flex flex-col gap-1">
            <ToggleButton
              label={season.label}
              title={seasonSpan(season)}
              count={season.months.reduce((sum, month) => sum + countOf(photos, month), 0)}
              on={on === 3}
              partly={on > 0}
              onClick={() => onChange(toggledSeason(chosen, season))}
            />
            {season.months.map((month) => (
              <ToggleButton
                key={month.value}
                label={month.short}
                title={month.label}
                count={countOf(photos, month)}
                on={chosen.includes(month.value)}
                onClick={() => onChange(toggledValue(chosen, month.value))}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** A row of toggles, one for each choice, such as the days of the week. */
export function ChoiceRow({
  choices,
  photos,
  chosen,
  onChange,
}: {
  choices: WhenChoice[];
  photos: Photo[];
  chosen: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {choices.map((choice) => (
        <ToggleButton
          key={choice.value}
          label={choice.short}
          title={choice.label}
          count={countOf(photos, choice)}
          on={chosen.includes(choice.value)}
          onClick={() => onChange(toggledValue(chosen, choice.value))}
        />
      ))}
    </div>
  );
}
