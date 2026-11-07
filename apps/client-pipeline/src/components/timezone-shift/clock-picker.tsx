import { ZoneField } from "@/components/timezone-shift/zone-pickers";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import type { ClockSetting } from "@/lib/clock-setting";
import { fromInputValue, inputValue } from "@/lib/photo-date";
import { readableTime, zoneOffsetOn } from "@/lib/timezone-shift";
import type { DayPhoto } from "@/lib/timezone-shift-plan";
import { cn } from "@/lib/utils";

type Kind = ClockSetting["kind"];

const KINDS: [Kind, string][] = [
  ["start", "Start timezone"],
  ["end", "End timezone"],
  ["zone", "Another timezone"],
  ["match", "Don't know"],
];

interface ClockPickerProps {
  /** The day's photos, in the order the clock took them. */
  photos: DayPhoto[];
  value: ClockSetting;
  onChange: (clock: ClockSetting) => void;
  /** Every timezone, for a clock set to another one. */
  options: ComboboxOption[];
  day: string;
}

/** The setting a kind starts as, with the first photo as the one of known time. */
function startingClock(kind: Kind, photos: DayPhoto[]): ClockSetting {
  if (kind === "zone") return { kind, zone: "" };
  if (kind === "match") return { kind, path: photos[0]?.photo.file.path ?? "", realTime: "" };
  return { kind };
}

/** What the camera's clock was set to that session, with what each choice needs. */
export function ClockPicker(props: ClockPickerProps) {
  const { photos, value, onChange } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <span id="timezone-shift-clock" className="text-xs font-medium">
        The camera&apos;s clock was set to
      </span>
      <div
        role="group"
        aria-labelledby="timezone-shift-clock"
        className="bg-background flex flex-wrap self-start rounded-md border p-0.5"
      >
        {KINDS.map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            aria-pressed={value.kind === kind}
            onClick={() => onChange(startingClock(kind, photos))}
            className={cn(
              "focus-visible:ring-ring rounded px-2 py-0.5 text-xs outline-none focus-visible:ring-2",
              value.kind === kind
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ClockDetail {...props} />
    </div>
  );
}

/** What the chosen kind of clock needs: a timezone, a photo's real time, or a note. */
function ClockDetail({ photos, value, onChange, options, day }: ClockPickerProps) {
  if (value.kind === "zone") {
    return (
      <ZoneField
        id="timezone-shift-clock-zone"
        label="The clock's timezone"
        help="The photos are read in this timezone's time."
        options={options}
        value={value.zone}
        offset={zoneOffsetOn(value.zone, day)}
        onChange={(zone) => onChange({ kind: "zone", zone })}
      />
    );
  }
  if (value.kind === "match") {
    return <MatchFields photos={photos} value={value} onChange={onChange} />;
  }
  return <p className="text-muted-foreground text-xs">{KIND_NOTES[value.kind]}</p>;
}

const KIND_NOTES: Record<"start" | "end", string> = {
  start: "The clock kept the start timezone's time all day, as a camera left on home time does.",
  end: "The clock was already on the end timezone's time, as when it's set before leaving.",
};

interface MatchFieldsProps {
  photos: DayPhoto[];
  value: Extract<ClockSetting, { kind: "match" }>;
  onChange: (clock: ClockSetting) => void;
}

/**
 * For a clock whose setting isn't known: one of the photos and the real local time it was taken,
 * such as from a phone photo of the same moment, which tells how far off the clock was.
 */
function MatchFields({ photos, value, onChange }: MatchFieldsProps) {
  const id = "timezone-shift-clock-match";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-medium">
        A photo you know the time of
        <select
          id={`${id}-photo`}
          className="border-input bg-background h-8 rounded-md border px-2 text-xs font-normal"
          value={value.path}
          onChange={(event) => onChange({ ...value, path: event.target.value })}
        >
          {photos.map((day) => (
            <option key={day.photo.file.path} value={day.photo.file.path}>
              {day.name} (clock {readableTime(day.clockTime)})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium">
        Its real local time
        <Input
          id={`${id}-time`}
          type="datetime-local"
          step={1}
          value={inputValue(value.realTime)}
          onChange={(event) => onChange({ ...value, realTime: fromInputValue(event.target.value) })}
        />
      </label>
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Such as from a phone photo of the same moment. It&apos;s read in the timezone of the side
        it&apos;s marked on below, and the other photos move by as much.
      </p>
    </div>
  );
}
