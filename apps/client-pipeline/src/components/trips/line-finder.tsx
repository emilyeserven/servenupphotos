import { useMutation, useQuery } from "@tanstack/react-query";
import { Route, X } from "lucide-react";
import { useState } from "react";
import { fetchTrack, type Spot, type TransitLine, transitLinesQuery } from "@/api/transit";
import type { TripTransitLine } from "@/api/trip-lines";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { LineBadge, LineChoices } from "@/components/trip-lines/line-choices";
import { Button } from "@/components/ui/button";
import { lineOf } from "@/lib/transit-line";
import { useRouteSourceStore } from "@/stores/route-source";

interface LineFinderProps {
  /** The kind of line, such as "train". */
  mode: string;
  /** The line picked; none until one is. */
  line?: TripTransitLine;
  /** Where the ride got on and off, as [longitude, latitude]. */
  ends: [Spot, Spot];
  /** Picks a line with its track between the ends, or takes it off with none. */
  onLine: (line?: TripTransitLine, path?: [number, number][]) => void;
}

/** The look-ups of a ride's line: the lines near both ends, once asked, and the picked one's track. */
function useLineFinder({ mode, ends, onLine }: LineFinderProps) {
  const [finding, setFinding] = useState(false);
  const [from, to] = ends;
  const source = useRouteSourceStore((s) => s.source);
  const lines = useQuery({ ...transitLinesQuery({ mode, from, to }, source), enabled: finding });
  const ride = useMutation({
    mutationFn: (line: TransitLine) => fetchTrack(line, from, to),
    onSuccess: ({ path }, line) => {
      onLine(lineOf(line), path);
      setFinding(false);
    },
  });
  return { finding, setFinding, lines, ride };
}

/** Whether a look-up is running. */
function isBusy(lines: { isFetching: boolean }, ride: { isPending: boolean }): boolean {
  return lines.isFetching || ride.isPending;
}

/** A ride's line and its look-up. */
export function LineFinder(props: LineFinderProps) {
  const { finding, setFinding, lines, ride } = useLineFinder(props);
  const busy = isBusy(lines, ride);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <LineBadge line={props.line} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setFinding(true)}>
          <RouteIcon busy={busy} />
          {props.line ? "Change route" : "Look up route"}
        </Button>
        <ClearButton line={props.line} onClear={() => props.onLine()} />
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

/** Takes the line off, drawing it straight again; nothing while there's none. */
function ClearButton({ line, onClear }: { line?: TripTransitLine; onClear: () => void }) {
  if (!line) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClear}>
      <X aria-hidden />
      Clear
    </Button>
  );
}

/** What the look-up found, said when it found none. */
function routeNote(finding: boolean, lines: TransitLine[] | undefined): string {
  if (!finding || lines === undefined || lines.length > 0) return "";
  return "No line of this kind found within 500 m of both ends. Try setting each end to its station, the other source, or Changed lines on the way if it changed trains.";
}
