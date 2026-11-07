import { Link } from "@tanstack/react-router";
import { CalendarClockIcon, RouteIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readableDate } from "@/lib/photo-date";
import { dayOf, readableDay, readableShift } from "@/lib/timezone-shift";
import { type PlannedShift, type TripLineEffect, movesDay } from "@/lib/timezone-shift-plan";
import { cn } from "@/lib/utils";

interface ShiftPreviewProps {
  plans: PlannedShift[];
  effects: TripLineEffect[];
}

/** Each photo's time now and after the fix, then what else the change touches. */
export function ShiftPreview({ plans, effects }: ShiftPreviewProps) {
  if (plans.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center">
        Choose both timezones, and what the camera's clock was set to, to see the new times.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Photo</TableHead>
            <TableHead>Now</TableHead>
            <TableHead>After the fix</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <PreviewRow key={plan.day.photo.file.path} plan={plan} />
          ))}
        </TableBody>
      </Table>
      <KnockOnNotes plans={plans} effects={effects} />
    </div>
  );
}

function PreviewRow({ plan }: { plan: PlannedShift }) {
  const unchanged = plan.minutes === 0;
  return (
    <TableRow className={cn(unchanged && "text-muted-foreground")}>
      <TableCell className="max-w-48 truncate">
        {plan.day.name}
        <span className="text-muted-foreground"> · {plan.side}</span>
      </TableCell>
      <TableCell>{readableDate(plan.day.currentTime)}</TableCell>
      <TableCell className={cn(!unchanged && "font-medium")}>
        {readableDate(plan.fixedTime)}
      </TableCell>
      <TableCell>
        {readableShift(plan.minutes)}
        {movesDay(plan) && (
          <span className="block text-amber-700 dark:text-amber-400">
            Moves to {readableDay(dayOf(plan.fixedTime))}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** What the fix does to the days photos are grouped by, given how many move to another day. */
function dayNote(moves: number): string {
  if (moves === 0) {
    return "Every photo stays on its day; only the order the portfolio's Timeline and the Grid's date sort show them in can change.";
  }
  const photos = moves === 1 ? "1 photo moves" : `${moves} photos move`;
  return `${photos} to another day, so the portfolio's Timeline, the Grid's date sort and Trip Lines put them on the new day.`;
}

/** What else changing the times touches: the days photos are grouped by, and trip lines. */
function KnockOnNotes({ plans, effects }: ShiftPreviewProps) {
  const changed = plans.filter((plan) => plan.minutes !== 0);
  if (changed.length === 0) return null;
  return (
    <ul className="text-muted-foreground flex flex-col gap-2 text-xs">
      <li className="flex gap-2">
        <CalendarClockIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {dayNote(changed.filter(movesDay).length)} Automatic trip lines are redrawn in the new
          order at the next Commit.
        </span>
      </li>
      {effects.map((effect) => (
        <TripLineNote key={effect.day} effect={effect} />
      ))}
    </ul>
  );
}

/** What the fix does to a hand-marked trip line, by how its day changes. */
const TRIP_LINE_NOTES: Record<TripLineEffect["kind"], string> = {
  leaves:
    "Photos it goes through move off that day, so Needs Attention will list it as out of date until it's redone.",
  joins:
    "Photos move onto that day; any with an exact spot aren't on the line, so Needs Attention will list it until it's redone.",
  order:
    "Its photos would be taken in another order, which Needs Attention doesn't catch, so check the line by hand.",
};

/** A hand-marked trip line the fix leaves out of date, with a link to redo it. */
function TripLineNote({ effect }: { effect: TripLineEffect }) {
  const what = TRIP_LINE_NOTES[effect.kind];
  return (
    <li className="flex gap-2 text-amber-700 dark:text-amber-400">
      <RouteIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>
        The trip line for{" "}
        <Link
          to="/trip-lines/$day/$part"
          params={{ day: effect.day, part: "route" }}
          className="underline"
        >
          {readableDay(effect.day)}
        </Link>{" "}
        was marked by hand. {what}
      </span>
    </li>
  );
}
