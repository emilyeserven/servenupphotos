import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  /** What the buttons choose, for screen readers, such as "Show the albums as". */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of joined buttons that picks one of a few options, such as Tree or Board. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-3 py-1 text-sm",
            value === option.value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
