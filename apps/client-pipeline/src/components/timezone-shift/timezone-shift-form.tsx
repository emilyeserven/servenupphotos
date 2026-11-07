import { useMemo, useState } from "react";
import { DayPhotoList } from "@/components/timezone-shift/day-photo-list";
import { ShiftPreview } from "@/components/timezone-shift/shift-preview";
import { useDatedPhotos } from "@/components/timezone-shift/use-day-photos";
import { ZonePickers } from "@/components/timezone-shift/zone-pickers";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { type ShiftSide, type ShiftZones, browserZone, dayOf } from "@/lib/timezone-shift";
import {
  CUSTOM_DATE,
  type DayPhoto,
  type PlannedShift,
  photosOnDay,
  planShifts,
  tripLineEffects,
} from "@/lib/timezone-shift-plan";
import { type FieldChange, useLocalEditsStore } from "@/stores/local-edits";

interface TimezoneShiftFormProps {
  /** The path of the photo open on the Photo page, whose day the form starts on. */
  currentPath: string;
  /** Called after the fix with the photo's new custom date ("" for none), when the fix changed it. */
  onCurrentFixed: (value: string) => void;
  /** Called after the fix is kept, with how many photos it changed. */
  onDone: (changed: number) => void;
}

/** The day the camera's clock says the photo was taken, or "" when it isn't listed. */
function startingDay(photos: DayPhoto[], path: string): string {
  const photo = photos.find((p) => p.photo.file.path === path);
  return photo ? dayOf(photo.clockTime) : "";
}

/** The local edit setting each changed photo's custom date. */
function changesOf(plans: PlannedShift[]): FieldChange[] {
  return plans.map((plan) => ({
    path: plan.day.photo.file.path,
    before: (plan.day.photo.file.data ?? {}) as Record<string, unknown>,
    value: plan.value,
  }));
}

/** The day's photos, which side of the change each was on, the two timezones, and a preview. */
export function TimezoneShiftForm(props: TimezoneShiftFormProps) {
  const { photos, lines, pending } = useDatedPhotos();
  if (pending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2">
        <Spinner /> Reading the photos…
      </p>
    );
  }
  return <ShiftForm {...props} photos={photos} lines={lines} />;
}

type ShiftFormProps = TimezoneShiftFormProps & Omit<ReturnType<typeof useDatedPhotos>, "pending">;

function ShiftForm({ currentPath, onCurrentFixed, onDone, photos, lines }: ShiftFormProps) {
  const [day, setDay] = useState(() => startingDay(photos, currentPath));
  const [sides, setSides] = useState<Record<string, ShiftSide>>({});
  const [zones, setZones] = useState<ShiftZones>(() => ({
    start: browserZone(),
    end: "",
    clock: "start",
  }));
  const setField = useLocalEditsStore((s) => s.setField);
  const onDay = useMemo(() => photosOnDay(photos, day), [photos, day]);
  const plans = useMemo(() => planShifts(onDay, sides, zones), [onDay, sides, zones]);
  const effects = useMemo(() => tripLineEffects(plans, photos, lines), [plans, photos, lines]);
  const changed = plans.filter((plan) => plan.minutes !== 0);

  const apply = () => {
    setField(CUSTOM_DATE, changesOf(changed));
    const current = changed.find((plan) => plan.day.photo.file.path === currentPath);
    if (current) onCurrentFixed(current.value ?? "");
    onDone(changed.length);
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <DayField day={day} onChange={setDay} count={onDay.length} />
      {onDay.length > 0 && (
        <DayPhotoList photos={onDay} sides={sides} onChange={setSides} currentPath={currentPath} />
      )}
      <ZonePickers zones={zones} onChange={setZones} day={day} />
      <ShiftPreview plans={plans} effects={effects} />
      <DialogFooter>
        <Button type="button" disabled={changed.length === 0} onClick={apply}>
          {changed.length === 1 ? "Fix 1 photo's time" : `Fix ${changed.length} photos' times`}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface DayFieldProps {
  day: string;
  onChange: (day: string) => void;
  /** How many photos are on the day. */
  count: number;
}

/** The day to fix, by the camera's clock, with how many photos were taken then. */
function DayField({ day, onChange, count }: DayFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="timezone-shift-day" className="text-xs font-medium">
        Day, by the camera&apos;s clock
      </label>
      <Input
        id="timezone-shift-day"
        type="date"
        className="max-w-48"
        value={day}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-muted-foreground text-xs">
        {count === 0
          ? "No photos were taken that day."
          : `${count} ${count === 1 ? "photo" : "photos"}, in the order the camera took them. Mark the ones taken after the timezone change.`}
      </span>
    </div>
  );
}
