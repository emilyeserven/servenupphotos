import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";

/** The time a newly picked day starts at, before one is typed. */
const MIDNIGHT = "00:00:00";

/** A date-time input's value split into its day and its time, each "" when it's empty. */
function splitValue(value: string): { day: string; time: string } {
  const [day = "", time = ""] = value.split("T");
  return { day, time };
}

/** The day picked with the time kept, or midnight when there's none yet; "" when the day is cleared. */
function withDay(day: string, time: string): string {
  return day ? `${day}T${time || MIDNIGHT}` : "";
}

interface DateTimePickerProps {
  /** The day button's id, so a label can point at it. */
  id?: string;
  /** The date and time as a native date-time input's value is ("2016-12-23T22:07:39"), or "". */
  value: string;
  /** Called with the new value in the same form, or "" when the day is cleared. */
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A date and time, which the app uses in place of the browser's date-time input: the day on the
 * shadcn calendar and the time, to the second, typed beside it. The value keeps the date-time
 * input's form, so it reads and writes the same as before.
 */
export function DateTimePicker({ id, value, onChange, disabled }: DateTimePickerProps) {
  const { day, time } = splitValue(value);
  return (
    <div className="flex flex-wrap gap-2">
      <DatePicker
        id={id}
        value={day}
        disabled={disabled}
        className="min-w-44 flex-1"
        onChange={(next) => onChange(withDay(next, time))}
      />
      <Input
        type="time"
        step={1}
        aria-label="Time"
        className="w-36 [&::-webkit-calendar-picker-indicator]:hidden"
        value={time}
        disabled={disabled || !day}
        onChange={(event) => onChange(`${day}T${event.target.value || MIDNIGHT}`)}
      />
    </div>
  );
}
