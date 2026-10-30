import { Input } from "@/components/ui/input";

/** The most photos Bulk Tagging can pick, and tag, at a time. */
const maxBulkTagCount = 50;

/** How many photos Bulk Tagging picks until another number is chosen. */
export const defaultBulkTagCount = 5;

/** The typed count as a whole number from 1 to 50, or `fallback` when it isn't a number. */
export function bulkTagCount(typed: string, fallback = defaultBulkTagCount) {
  const count = Math.round(Number(typed));
  if (!Number.isFinite(count) || count < 1) return fallback;
  return Math.min(count, maxBulkTagCount);
}

interface PickCountProps {
  /** What's counted, such as "Photos to pick". */
  label?: string;
  /** The count when what's typed isn't a number. */
  fallback?: number;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** Chooses how many photos the next pick finds, or names the next prompt asks about, from 1 to 50. */
export function PickCount({
  label = "Photos to pick",
  fallback = defaultBulkTagCount,
  value,
  disabled,
  onChange,
}: PickCountProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      {label}
      <Input
        type="number"
        min={1}
        max={maxBulkTagCount}
        step={1}
        className="w-20"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(String(bulkTagCount(value, fallback)))}
      />
    </label>
  );
}
