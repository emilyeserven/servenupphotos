import { useMutation, useQuery } from "@tanstack/react-query";
import { Route, X } from "lucide-react";
import { useState } from "react";
import { fetchTrack, type Spot, type TransitLine, transitLinesQuery } from "@/api/transit";
import type { TripTransitLine } from "@/api/trip-lines";
import type { TripLeg } from "@/api/trips";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { LineBadge, LineChoices } from "@/components/trip-lines/line-choices";
import { Button } from "@/components/ui/button";
import { ridesLegLine } from "@/lib/trip-legs";

interface LegRouteProps {
  leg: TripLeg;
  /** Where the leg leaves and arrives, as [longitude, latitude]; none while an end has no spot. */
  ends?: [Spot, Spot];
  onChange: (leg: TripLeg) => void;
}

/** The line as a leg keeps it: no kind or ends. */
function lineOf({ id, name, ref, colour }: TransitLine): TripTransitLine {
  return { id, name, ...(ref && { ref }), ...(colour && { colour }) };
}

/** The leg without its line and track, drawn straight again. */
function withoutLine({ line: _line, path: _path, ...leg }: TripLeg): TripLeg {
  return leg;
}

/**
 * The train, bus or ferry line a leg rode: **Look up route** finds the lines OpenStreetMap maps
 * near both of its ends (best with each end at its station), and picking one draws the leg along
 * the line's track, in its color. Nothing for a flight or a drive.
 */
export function LegRoute({ leg, ends, onChange }: LegRouteProps) {
  if (!ridesLegLine(leg.mode)) return null;
  if (!ends) {
    return (
      <p className="text-muted-foreground text-xs">
        Give both ends a spot to look up the route it rode.
      </p>
    );
  }
  return <RouteFinder leg={leg} ends={ends} onChange={onChange} />;
}

/** The look-ups of a leg's line: the lines near both ends, once asked, and the picked one's track. */
function useLegRoute({ leg, ends, onChange }: LegRouteProps & { ends: [Spot, Spot] }) {
  const [finding, setFinding] = useState(false);
  const [from, to] = ends;
  const lines = useQuery({
    ...transitLinesQuery({ mode: leg.mode, from, to }),
    enabled: finding,
  });
  const ride = useMutation({
    mutationFn: (line: TransitLine) => fetchTrack(line.id, from, to),
    onSuccess: ({ path }, line) => {
      onChange({ ...leg, line: lineOf(line), path });
      setFinding(false);
    },
  });
  return { finding, setFinding, lines, ride };
}

/** Whether a look-up is running. */
function isBusy(lines: { isFetching: boolean }, ride: { isPending: boolean }): boolean {
  return lines.isFetching || ride.isPending;
}

/** The leg's line and its look-up, once both ends have a spot. */
function RouteFinder(props: LegRouteProps & { ends: [Spot, Spot] }) {
  const { leg, onChange } = props;
  const { finding, setFinding, lines, ride } = useLegRoute(props);
  const busy = isBusy(lines, ride);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Route:</span>
        <LineBadge line={leg.line} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setFinding(true)}>
          <RouteIcon busy={busy} />
          {leg.line ? "Change route" : "Look up route"}
        </Button>
        <ClearButton leg={leg} onChange={onChange} />
      </div>
      {finding && <LineChoices lines={lines.data} disabled={busy} onPick={ride.mutate} />}
      <SaveNote error={lines.error ?? ride.error} why={routeNote(finding, lines.data)} />
    </div>
  );
}

/** A spinner while looking up, or else the route icon. */
function RouteIcon({ busy }: { busy: boolean }) {
  return busy ? <Busy busy /> : <Route aria-hidden />;
}

/** Takes the leg's line off, drawing it straight again; nothing while it has none. */
function ClearButton({ leg, onChange }: Omit<LegRouteProps, "ends">) {
  if (!leg.line) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => onChange(withoutLine(leg))}>
      <X aria-hidden />
      Clear
    </Button>
  );
}

/** What the look-up found, said when it found none. */
function routeNote(finding: boolean, lines: TransitLine[] | undefined): string {
  if (!finding || lines === undefined || lines.length > 0) return "";
  return "OpenStreetMap maps no line of this kind within 500 m of both ends. Try setting each end to its station.";
}
