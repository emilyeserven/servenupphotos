import { ArrowRight } from "lucide-react";
import { Fragment } from "react";
import type { TripSegment } from "@/api/trip-lines";
import { LineBadge } from "@/components/trip-lines/line-choices";

/**
 * The line a hop rode, or each line in turn when its route changed lines, such as 北松江線, a
 * change at 川跡, then 大社線.
 */
export function HopLineBadge({ hop }: { hop: TripSegment }) {
  const rides = hop.rides ?? [];
  if (rides.length < 2) return <LineBadge line={hop.line} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" aria-label="Lines ridden in turn">
      {rides.map((ride, i) => (
        <Fragment key={i}>
          <LineBadge line={ride.line} />
          {ride.change && i < rides.length - 1 && <ChangeAt name={ride.change.label} />}
        </Fragment>
      ))}
    </span>
  );
}

/** Where the ride changed to the next line, between their names. */
function ChangeAt({ name }: { name?: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <ArrowRight className="size-3" aria-hidden />
      {name ? `change at ${name}` : "change"}
      <ArrowRight className="size-3" aria-hidden />
    </span>
  );
}
