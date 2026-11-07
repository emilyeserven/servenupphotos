import { useMemo } from "react";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { type ShiftZones, knownZones, zoneOffsetOn } from "@/lib/timezone-shift";

interface ZonePickersProps {
  zones: ShiftZones;
  onChange: (zones: ShiftZones) => void;
  /** The day being fixed, so each timezone shows its offset that day, daylight saving and all. */
  day: string;
}

/** Each timezone as an option, with its offset on the day, such as "Asia/Tokyo" and "UTC+9". */
export function zoneOptions(day: string): ComboboxOption[] {
  return knownZones().map((zone) => ({
    value: zone,
    label: zone.replaceAll("_", " "),
    detail: zoneOffsetOn(zone, day),
    keywords: zone,
  }));
}

/** The start and end timezones of the day. */
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

/** One timezone, typed to filter, with its offset on the day beside its label. */
export function ZoneField({ id, label, help, options, value, offset, onChange }: ZoneFieldProps) {
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
