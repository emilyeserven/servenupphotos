import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";
import {
  type Daypart,
  daypartSpan,
  type Season,
  type WhenChoice,
} from "@portfolio/lib/when-filters";

/** How a toggle looks: on, off with no photos, or off. */
type ToggleState = "on" | "empty" | "off";

const STATE_CLASSES: Record<ToggleState, string> = {
  on: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  empty: "opacity-40",
  off: "",
};

/** How a toggle looks: being on wins over having no photos. */
function toggleState(on: boolean, count: number): ToggleState {
  if (on) return "on";
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
  onClick,
}: {
  label: string;
  title?: string;
  count: number;
  on: boolean;
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
        STATE_CLASSES[toggleState(on, count)],
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

/** The chosen values with all of `values` turned on, or off when they all already are. */
function toggledAll(chosen: string[], values: string[]): string[] {
  const rest = chosen.filter((value) => !values.includes(value));
  return values.every((value) => chosen.includes(value)) ? rest : [...rest, ...values];
}

/** What a grid of toggles reads and changes. */
interface GridProps {
  /** The photos each choice's count is out of. */
  photos: Photo[];
  chosen: string[];
  onChange: (values: string[]) => void;
}

/** A toggle for one choice. */
function ChoiceToggle({ choice, photos, chosen, onChange }: GridProps & { choice: WhenChoice }) {
  return (
    <ToggleButton
      label={choice.short}
      title={choice.label}
      count={countOf(photos, choice)}
      on={chosen.includes(choice.value)}
      onClick={() => onChange(toggledValue(chosen, choice.value))}
    />
  );
}

/** The choices as a grid of toggles, `columns` across, such as the days of the week. */
export function ChoiceGrid({
  choices,
  columns,
  ...props
}: GridProps & { choices: WhenChoice[]; columns: string }) {
  return (
    <div className={cn("grid gap-1.5", columns)}>
      {choices.map((choice) => (
        <ChoiceToggle key={choice.value} choice={choice} {...props} />
      ))}
    </div>
  );
}

/** The months as four columns, one for each season, headed by its name. */
export function MonthColumns({ seasons, ...props }: GridProps & { seasons: Season[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {seasons.map((season) => (
        <div key={season.value} className="flex flex-col gap-1">
          <span className="text-center text-xs text-muted-foreground">{season.label}</span>
          {season.months.map((month) => (
            <ChoiceToggle key={month.value} choice={month} {...props} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The hours as a row for each part of the day: its name, which turns all its hours on, or off
 * once they all are, then a toggle for each hour.
 */
export function HourRows({ dayparts, ...props }: GridProps & { dayparts: Daypart[] }) {
  return (
    <div className="flex flex-col gap-1">
      {dayparts.map((part) => {
        const values = part.hours.map((hour) => hour.value);
        const on = values.filter((value) => props.chosen.includes(value)).length;
        return (
          <div key={part.label} className="grid grid-cols-[6.5rem_repeat(5,1fr)] gap-1">
            <button
              type="button"
              aria-pressed={on === values.length}
              title={daypartSpan(part)}
              onClick={() => props.onChange(toggledAll(props.chosen, values))}
              className={cn(
                "truncate rounded-md px-1.5 text-left text-xs font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on > 0 && "text-primary underline underline-offset-2",
              )}
            >
              {part.label}
            </button>
            {part.hours.map((hour) => (
              <ChoiceToggle key={hour.value} choice={hour} {...props} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
