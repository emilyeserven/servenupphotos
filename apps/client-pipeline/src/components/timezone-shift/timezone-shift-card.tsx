import { GlobeIcon } from "lucide-react";
import { useState } from "react";
import { TimezoneShiftForm } from "@/components/timezone-shift/timezone-shift-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TimezoneShiftCardProps {
  /** The path of the photo open on the Photo page. */
  path: string;
  /** Called with the photo's new custom date ("" for none) when the fix changes it. */
  onCurrentFixed: (value: string) => void;
  disabled: boolean;
}

/** What the last fix did, for the card to say. */
function doneText(changed: number): string {
  const photos = changed === 1 ? "1 photo's time" : `${changed} photos' times`;
  return `Fixed ${photos}. The new custom dates are waiting for Commit.`;
}

/**
 * Fixes the times of a day that crossed timezones: pick the day's photos taken before and after the
 * change and the two timezones, check the new times, and keep them as custom dates until Commit.
 */
export function TimezoneShiftCard({ path, onCurrentFixed, disabled }: TimezoneShiftCardProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Times across timezones</CardTitle>
        <CardDescription>
          Each camera keeps its own clock, which may be on home time, the new time or just wrong, so
          on a day you crossed timezones its photos can carry the wrong time. This fixes them,
          camera by camera, by writing each photo&apos;s local time into its custom date; the EXIF
          date is kept as it is.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
            <GlobeIcon />
            Fix times across timezones…
          </Button>
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Fix times across timezones</DialogTitle>
              <DialogDescription>
                Choose where the day started and ended, say what each camera&apos;s clock was set
                to, mark which photos were taken after the change, and check the new times before
                keeping them.
              </DialogDescription>
            </DialogHeader>
            {open && (
              <TimezoneShiftForm
                currentPath={path}
                onCurrentFixed={onCurrentFixed}
                onDone={(changed) => {
                  setDone(changed);
                  setOpen(false);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        {done !== null && <p className="text-muted-foreground text-xs">{doneText(done)}</p>}
      </CardContent>
    </Card>
  );
}
