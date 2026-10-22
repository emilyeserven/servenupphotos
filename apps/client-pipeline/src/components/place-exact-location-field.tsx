interface PlaceExactLocationFieldProps {
  checked: boolean;
  /** Whether the place has a GPS position typed in; without one there's nothing to be exact about. */
  hasGps: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Whether the place's GPS position is exactly where its photos were taken, such as a subway station
 * or a museum. The portfolio's map then gives those photos the same solid white border as photos
 * with their own GPS position, rather than the softer one for a position that's only near.
 */
export function PlaceExactLocationField({
  checked,
  hasGps,
  disabled,
  onChange,
}: PlaceExactLocationFieldProps) {
  return (
    <label className="flex items-start gap-2 text-sm has-disabled:opacity-60">
      <input
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={checked && hasGps}
        disabled={disabled || !hasGps}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">Exact location</span>
        <span className="text-muted-foreground">
          {hasGps
            ? "The GPS position is where its photos were taken, such as a station or a museum, so the portfolio's map shows them like photos with their own GPS position."
            : "Add a GPS position to mark it as exactly where its photos were taken."}
        </span>
      </span>
    </label>
  );
}
