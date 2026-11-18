import type { ViaBy } from "@/api/trip-lines";

/** The choices for how a walk goes to and from a via point, as the menu lists them. */
const CHOICES: { value: ViaBy | ""; label: string }[] = [
  { value: "", label: "Auto" },
  { value: "road", label: "Road" },
  { value: "foot", label: "Walkway" },
];

interface ViaBySelectProps {
  /** What's picked: a way, "" for Auto, or undefined when the via points it covers differ. */
  value: ViaBy | "" | undefined;
  onChange: (by: ViaBy | undefined) => void;
  /** Names the menu for a screen reader, such as "Via point 3 goes by". */
  label: string;
}

/**
 * A small menu for how a walk goes to and from via points when snapped to streets: Auto (Snap to
 * streets chooses), Road (as a car would, for a road closed to people on foot) or Walkway.
 */
export function ViaBySelect({ value, onChange, label }: ViaBySelectProps) {
  return (
    <select
      aria-label={label}
      title="How the walk goes to and from it when snapped to streets"
      className="border-input bg-background h-7 rounded-md border px-1 text-xs"
      value={value ?? "mixed"}
      onChange={(e) => onChange((e.target.value || undefined) as ViaBy | undefined)}
    >
      {value === undefined && (
        <option value="mixed" disabled>
          Mixed
        </option>
      )}
      {CHOICES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
