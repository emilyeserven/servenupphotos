import { DatePicker } from "@/components/date-picker";

/** The days to list photos from, as "2016-12-23"; `to` is blank for one day. */
interface DayRange {
  from: string;
  to: string;
}

interface DayRangeFieldsProps {
  value: DayRange;
  onChange: (range: DayRange) => void;
  /** How many photos the days have. */
  count: number;
}

/** What the range lists, or what to do to list something. */
function countText({ from }: DayRange, count: number): string {
  if (!from) return "Pick a day, or the first and last of a range, to list their photos.";
  if (count === 0) return "No photos were taken then.";
  const photos = count === 1 ? "1 photo" : `${count} photos`;
  return `${photos}, in the order the camera took them. Mark the ones taken after the timezone change.`;
}

/** The first and last day to list photos from, by the camera's clock. */
export function DayRangeFields({ value, onChange, count }: DayRangeFieldsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium">
          From
          <DatePicker
            className="w-52"
            value={value.from}
            onChange={(from) => onChange({ ...value, from })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium">
          To (optional)
          <DatePicker
            className="w-52"
            value={value.to}
            min={value.from}
            onChange={(to) => onChange({ ...value, to })}
          />
        </label>
      </div>
      <span className="text-muted-foreground text-xs">{countText(value, count)}</span>
    </div>
  );
}
