import { useMemo } from "react";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { type ClockZone, type ShiftZones, knownZones, zoneOffsetOn } from "@/lib/timezone-shift";
import { cn } from "@/lib/utils";

interface ZonePickersProps {
  zones: ShiftZones;
  onChange: (zones: ShiftZones) => void;
  /** The day being fixed, so each timezone shows its offset that day, daylight saving and all. */
  day: string;
}

/** Each timezone as an option, with its offset on the day, such as "Asia/Tokyo" and "UTC+9". */
function zoneOptions(day: string): ComboboxOption[] {
  return knownZones().map((zone) => ({
    value: zone,
    label: zone.replaceAll("_", " "),
    detail: zoneOffsetOn(zone, day),
    keywords: zone,
  }));
}

/** The start and end timezones of the day, and which one the camera's clock was set to. */
export function ZonePickers({ zones, onChange, day }: ZonePickersProps) {
  const options = useMemo(() => zoneOptions(day), [day]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ZoneField
        id="timezone-shift-start"
        label="Start timezone"
        help="Where you were before the change."
        options={options}
        value={zones.start}
        offset={zoneOffsetOn(zones.start, day)}
        onChange={(start) => onChange({ ...zones, start })}
      />
      <ZoneField
        id="timezone-shift-end"
        label="End timezone"
        help="Where you were after it."
        options={options}
        value={zones.end}
        offset={zoneOffsetOn(zones.end, day)}
        onChange={(end) => onChange({ ...zones, end })}
      />
      <ClockToggle value={zones.clock} onChange={(clock) => onChange({ ...zones, clock })} />
    </div>
  );
}

interface ZoneFieldProps {
  id: string;
  label: string;
  help: string;
  options: ComboboxOption[];
  value: string;
  /** The chosen timezone's offset on the day, or "" with none chosen. */
  offset: string;
  onChange: (zone: string) => void;
}

function ZoneField({ id, label, help, options, value, offset, onChange }: ZoneFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-xs font-medium">
        {label}
        {offset && <span className="text-muted-foreground font-normal"> · {offset}</span>}
      </span>
      <SingleCombobox
        id={id}
        aria-labelledby={`${id}-label`}
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Type a city, such as Tokyo"
      />
      <span className="text-muted-foreground text-xs">{help}</span>
    </div>
  );
}

const CLOCK_CHOICES: [ClockZone, string][] = [
  ["start", "Start timezone"],
  ["end", "End timezone"],
];

/** Which timezone the camera's clock was set to all day. */
function ClockToggle({
  value,
  onChange,
}: {
  value: ClockZone;
  onChange: (clock: ClockZone) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span id="timezone-shift-clock" className="text-xs font-medium">
        The camera&apos;s clock was set to
      </span>
      <div
        role="group"
        aria-labelledby="timezone-shift-clock"
        className="bg-background flex self-start rounded-md border p-0.5"
      >
        {CLOCK_CHOICES.map(([choice, label]) => (
          <button
            key={choice}
            type="button"
            aria-pressed={value === choice}
            onClick={() => onChange(choice)}
            className={cn(
              "focus-visible:ring-ring rounded px-2 py-0.5 text-xs outline-none focus-visible:ring-2",
              value === choice
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="text-muted-foreground text-xs">
        Usually the start one: the camera kept home time after the trip. Pick the end one if you set
        it to the new time before leaving. Photos taken in the clock&apos;s own timezone keep their
        time.
      </span>
    </div>
  );
}
