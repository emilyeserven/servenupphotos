import { Input } from "@/components/ui/input";

/** The most photos Bulk Tagging can pick, and tag, at a time. */
const maxBulkTagCount = 50;

/** How many photos Bulk Tagging picks until another number is chosen. */
export const defaultBulkTagCount = 5;

/** The typed count as a whole number from 1 to 50, or the default when it isn't a number. */
export function bulkTagCount(typed: string) {
  const count = Math.round(Number(typed));
  if (!Number.isFinite(count) || count < 1) return defaultBulkTagCount;
  return Math.min(count, maxBulkTagCount);
}

interface PickCountProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** Chooses how many photos the next pick finds, from 1 to 50. */
export function PickCount({ value, disabled, onChange }: PickCountProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      Photos to pick
      <Input
        type="number"
        min={1}
        max={maxBulkTagCount}
        step={1}
        className="w-20"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(String(bulkTagCount(value)))}
      />
    </label>
  );
}
