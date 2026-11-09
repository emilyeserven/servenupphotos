import { useState } from "react";
import type { TripPoint } from "@/api/trip-lines";
import { Input } from "@/components/ui/input";
import { parsePosition } from "@/lib/trip-legs";

interface PointFieldsProps {
  point: TripPoint;
  /** What the point is, such as "Leaves", for the fields' labels. */
  title: string;
  /** What to suggest as its label, such as "Hakata Port". */
  placeholder: string;
  onChange: (point: TripPoint) => void;
}

/**
 * A spot or station typed by hand: its label and where it is, as "latitude, longitude", such as
 * copied from Google Maps. Give it a new key to show a position set from elsewhere.
 */
export function PointFields({ point, title, placeholder, onChange }: PointFieldsProps) {
  const [text, setText] = useState(() => `${point.latitude}, ${point.longitude}`);
  const valid = parsePosition(text) !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <Input
        value={point.label ?? ""}
        placeholder={placeholder}
        aria-label={`${title}: the spot's label`}
        onChange={(e) => onChange({ ...point, label: e.target.value })}
      />
      <Input
        value={text}
        placeholder="33.6064, 130.4017"
        aria-label={`${title}: latitude, longitude`}
        aria-invalid={!valid}
        onChange={(e) => {
          setText(e.target.value);
          const at = parsePosition(e.target.value);
          if (at) onChange({ ...point, ...at });
        }}
      />
      <p className="text-muted-foreground text-xs">
        {valid
          ? "Latitude, longitude, such as from Google Maps."
          : "Type it as latitude, longitude."}
      </p>
    </div>
  );
}
