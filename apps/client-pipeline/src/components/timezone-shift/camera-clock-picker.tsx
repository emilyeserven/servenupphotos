import { ZoneField } from "@/components/timezone-shift/zone-pickers";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import type { CameraClock } from "@/lib/camera-clock";
import { fromInputValue, inputValue } from "@/lib/photo-date";
import { readableTime, zoneOffsetOn } from "@/lib/timezone-shift";
import type { DayPhoto } from "@/lib/timezone-shift-plan";
import { cn } from "@/lib/utils";

type Kind = CameraClock["kind"];

/** The camera's name as part of an element id, with no spaces. */
function idOf(camera: string): string {
  return camera.replaceAll(/\W+/g, "-");
}

const KINDS: [Kind, string][] = [
  ["start", "Start timezone"],
  ["end", "End timezone"],
  ["zone", "Another timezone"],
  ["match", "Don't know"],
  ["right", "Already right"],
];

interface CameraClockPickerProps {
  /** The camera's name, for the fields' ids and labels. */
  camera: string;
  /** The camera's photos that day, in the order its clock took them. */
  photos: DayPhoto[];
  value: CameraClock;
  onChange: (clock: CameraClock) => void;
  /** Every timezone, for a clock set to another one. */
  options: ComboboxOption[];
  day: string;
}

/** The setting a kind starts as, with the camera's first photo as the one of known time. */
function startingClock(kind: Kind, photos: DayPhoto[]): CameraClock {
  if (kind === "zone") return { kind, zone: "" };
  if (kind === "match") return { kind, path: photos[0]?.photo.file.path ?? "", realTime: "" };
  return { kind };
}

/** What the camera's clock was set to that day, with what each choice needs. */
export function CameraClockPicker(props: CameraClockPickerProps) {
  const { camera, photos, value, onChange } = props;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`What the ${camera} clock was set to`}
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
function ClockDetail({ camera, photos, value, onChange, options, day }: CameraClockPickerProps) {
  if (value.kind === "zone") {
    return (
      <ZoneField
        id={`clock-zone-${idOf(camera)}`}
        label="The clock's timezone"
        help="Its photos are read in this timezone's time."
        options={options}
        value={value.zone}
        offset={zoneOffsetOn(value.zone, day)}
        onChange={(zone) => onChange({ kind: "zone", zone })}
      />
    );
  }
  if (value.kind === "match") {
    return <MatchFields camera={camera} photos={photos} value={value} onChange={onChange} />;
  }
  return <p className="text-muted-foreground text-xs">{KIND_NOTES[value.kind]}</p>;
}

const KIND_NOTES: Record<"start" | "end" | "right", string> = {
  start: "The clock kept the start timezone's time all day, as a camera left on home time does.",
  end: "The clock was already on the end timezone's time, as when it's set before leaving.",
  right:
    "The clock showed the local time wherever it was, as a phone sets its own, so its photos keep their times.",
};

interface MatchFieldsProps {
  camera: string;
  photos: DayPhoto[];
  value: Extract<CameraClock, { kind: "match" }>;
  onChange: (clock: CameraClock) => void;
}

/**
 * For a clock whose setting isn't known: one of its photos and the real local time it was taken,
 * such as from a phone photo of the same moment, which tells how far off the clock was.
 */
function MatchFields({ camera, photos, value, onChange }: MatchFieldsProps) {
  const id = `clock-match-${idOf(camera)}`;
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
        it&apos;s marked on below, and the clock&apos;s other photos move by as much.
      </p>
    </div>
  );
}
