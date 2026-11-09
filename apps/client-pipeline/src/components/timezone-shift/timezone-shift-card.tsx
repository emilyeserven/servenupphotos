import { useMemo, useState } from "react";
import { ClockPicker } from "@/components/timezone-shift/clock-picker";
import { DayPhotoList } from "@/components/timezone-shift/day-photo-list";
import { DayRangeFields } from "@/components/timezone-shift/day-range-fields";
import { ShiftPreview } from "@/components/timezone-shift/shift-preview";
import { useDatedPhotos } from "@/components/timezone-shift/use-day-photos";
import { ZonePickers, zoneOptions } from "@/components/timezone-shift/zone-pickers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { type ClockSetting, DEFAULT_CLOCK } from "@/lib/clock-setting";
import { type ShiftSide, type ShiftZones, browserZone } from "@/lib/timezone-shift";
import {
  type PlannedShift,
  photosInRange,
  planShifts,
  tripLineEffects,
} from "@/lib/timezone-shift-plan";
import { type FieldChange, useLocalEditsStore } from "@/stores/local-edits";
import { CUSTOM_DATE } from "@/lib/photo-fields";

/**
 * Update Data's Times across timezones: fixes a session of photos whose camera clock was wrong
 * after crossing timezones. Pick the days to list the photos, the two timezones and what the
 * clock was set to, mark the photos taken after the change, check the new times, and keep them as
 * custom dates until Commit.
 */
export function TimezoneShiftCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Times across timezones</CardTitle>
        <CardDescription>
          A camera&apos;s clock may be on home time, the new time or just wrong, so on a day you
          crossed timezones its photos can carry the wrong time. Pick the days to list their photos,
          then say where you were and what the clock was set to. Each photo&apos;s local time is
          written into its custom date, waiting for Commit; the EXIF date is kept as it is.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ShiftFormLoader />
      </CardContent>
    </Card>
  );
}

/** Waits for the photos from Photos in Flight and the Gallery, then shows the form. */
function ShiftFormLoader() {
  const { photos, lines, pending } = useDatedPhotos();
  if (pending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2">
        <Spinner /> Reading the photos…
      </p>
    );
  }
  return <ShiftForm photos={photos} lines={lines} />;
}

/** The local edit setting each changed photo's custom date. */
function changesOf(plans: PlannedShift[]): FieldChange[] {
  return plans.map((plan) => ({
    path: plan.day.photo.file.path,
    before: (plan.day.photo.file.data ?? {}) as Record<string, unknown>,
    value: plan.value,
  }));
}

/** What the last fix did. */
function doneText(changed: number): string {
  const photos = changed === 1 ? "1 photo's time" : `${changed} photos' times`;
  return `Fixed ${photos}. The new custom dates are waiting for Commit.`;
}

type ShiftFormProps = Omit<ReturnType<typeof useDatedPhotos>, "pending">;

function ShiftForm({ photos, lines }: ShiftFormProps) {
  const [range, setRange] = useState({ from: "", to: "" });
  const [sides, setSides] = useState<Record<string, ShiftSide>>({});
  const [zones, setZones] = useState<ShiftZones>(() => ({ start: browserZone(), end: "" }));
  const [clock, setClock] = useState<ClockSetting>(DEFAULT_CLOCK);
  const [done, setDone] = useState<number | null>(null);
  const setField = useLocalEditsStore((s) => s.setField);
  const options = useMemo(() => zoneOptions(range.from), [range.from]);
  const listed = useMemo(
    () => photosInRange(photos, range.from, range.to),
    [photos, range.from, range.to],
  );
  const plans = useMemo(
    () => planShifts(listed, sides, zones, clock),
    [listed, sides, zones, clock],
  );
  const effects = useMemo(() => tripLineEffects(plans, photos, lines), [plans, photos, lines]);
  const changed = plans.filter((plan) => plan.minutes !== 0);

  const apply = () => {
    setField(CUSTOM_DATE, changesOf(changed));
    setDone(changed.length);
  };

  return (
    <div className="flex flex-col gap-5">
      <DayRangeFields value={range} onChange={setRange} count={listed.length} />
      <ZonePickers zones={zones} onChange={setZones} day={range.from} />
      <ClockPicker
        photos={listed}
        value={clock}
        onChange={setClock}
        options={options}
        day={range.from}
      />
      {listed.length > 0 && <DayPhotoList photos={listed} sides={sides} onChange={setSides} />}
      <ShiftPreview plans={plans} effects={effects} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={changed.length === 0} onClick={apply}>
          {changed.length === 1 ? "Fix 1 photo's time" : `Fix ${changed.length} photos' times`}
        </Button>
        {done !== null && <span className="text-muted-foreground text-xs">{doneText(done)}</span>}
      </div>
    </div>
  );
}
