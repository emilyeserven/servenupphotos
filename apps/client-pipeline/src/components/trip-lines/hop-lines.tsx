import { Search, X } from "lucide-react";
import type { HopAsk, Spot, TransitLine } from "@/api/transit";
import type { TripPoint, TripSegment } from "@/api/trip-lines";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { HopEndsPicker } from "@/components/trip-lines/hop-ends";
import { HopStations } from "@/components/trip-lines/hop-stations";
import { HopRideRows } from "@/components/trip-lines/hop-ride-rows";
import { LineBadge, LineChoices } from "@/components/trip-lines/line-choices";
import { LookupKind } from "@/components/trip-lines/lookup-kind";
import { RouteSourcePicker } from "@/components/trip-lines/route-source-picker";
import { gapInfo } from "@/components/trip-lines/modes";
import { type HopEnds, useHopRide } from "@/components/trip-lines/use-hop-ride";
import { Button } from "@/components/ui/button";
import type { Ride } from "@/lib/transit-ride";
import type { TripPhoto } from "@/lib/trip-days";
import type { Gap, GapDraft } from "@/lib/trip-gaps";
import { legKeys } from "@/lib/hop-legs";
import { ridesLine, withHopLine } from "@/lib/trip-hop-lines";

interface HopLinesProps {
  photos: TripPhoto[];
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/**
 * The line each train, subway or bus hop rode, one row for each stretch between photos and trip stops
 * on it: Find lines looks up the ones OpenStreetMap maps near
 * both of its ends, and picking one draws the hop along its track, in its color.
 */
export function HopLines({ photos, draft, segments, onChange }: HopLinesProps) {
  const keys = legKeys(segments);
  const hops = segments.flatMap((s, i) => (ridesLine(s) ? [{ hop: s, key: keys[i]! }] : []));
  if (hops.length === 0) return null;
  const byId = new Map(photos.map((p, i) => [p.id, { photo: p, n: i + 1 }]));
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Lines ridden</h3>
      {hops.map(({ hop, key }) => (
        <HopRow
          key={`${key}-${hop.mode}`}
          hop={hop}
          ends={legEnds(hop, byId)}
          onRide={(ride) => onChange(withHopLine(draft, hop, key, ride))}
        />
      ))}
    </div>
  );
}

/** One end of a leg: a photo with its number on the map, or a spot with no photo, such as a trip stop. */
type HopEnd = { photo: TripPhoto; n: number } | { point: TripPoint } | undefined;

/** The leg's two ends: its start spot or first photo, and its end spot or last photo. */
function legEnds(hop: TripSegment, byId: Map<number, { photo: TripPhoto; n: number }>): HopEnd[] {
  const first = hop.start ? { point: hop.start } : byId.get(hop.photos[0]!);
  const last = hop.end ? { point: hop.end } : byId.get(hop.photos.at(-1)!);
  return [first, last];
}

/** An end's spot as [longitude, latitude]. */
function spotOf(end: NonNullable<HopEnd>): Spot {
  const p = "photo" in end ? end.photo : end.point;
  return [p.longitude, p.latitude];
}

/** What the leg's look-ups ask: its mode and its two ends' spots; none when an end is missing. */
function askOf(hop: TripSegment, [a, b]: HopEnd[]): HopAsk | undefined {
  if (!a || !b) return undefined;
  return { mode: hop.mode, from: spotOf(a), to: spotOf(b) };
}

interface HopRowProps {
  hop: TripSegment;
  ends: HopEnd[];
  onRide: (ride?: Ride) => void;
}

/**
 * One hop: which photos it joins, the line it rode and where it got on and off, and the lines to
 * pick from, looked up at once while it has no line. When none is found near the photos, stations
 * can be picked to look near instead.
 */
function HopRow({ hop, ends, onRide }: HopRowProps) {
  const ask = askOf(hop, ends);
  const found = useHopRide(hop, ask, onRide);
  const { finding, setFinding, kind, setKind, lines, mutation, ride } = found;
  const busy = busyOf(lines, mutation);
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {hopTitle(ends)} by {gapInfo(hop.mode as Gap).label.toLowerCase()}:
        </span>
        <LineBadge line={hop.line} />
        <RouteSourcePicker />
        <HopButtons
          hop={hop}
          busy={busy}
          onFind={() => setFinding(true)}
          onClear={() => onRide(undefined)}
        />
      </div>
      <HopRideRows hop={hop} />
      {hop.line && (
        <HopStations
          hop={{ ...hop, line: hop.line }}
          disabled={busy}
          onChange={(chosen) => ride(hop.line!, chosen)}
        />
      )}
      {finding && <LookupKind mode={hop.mode} kind={kind} disabled={busy} onKind={setKind} />}
      <HopEndsPicker
        ask={ask}
        kind={kind}
        shown={picksEnds(finding, found.ends, lines.data)}
        ends={found.ends}
        onEnds={found.setEnds}
      />
      {finding && <LineChoices lines={lines.data} onPick={ride} disabled={busy} />}
      <SaveNote error={errorOf(lines, mutation)} why={findNote(finding, lines)} />
    </div>
  );
}

interface Pending {
  isFetching?: boolean;
  isPending?: boolean;
  error: Error | null;
}

/** Whether the lines are being found or a ride's track fetched. */
function busyOf(lines: Pending, ride: Pending): boolean {
  return Boolean(lines.isFetching || ride.isPending);
}

/** Why finding lines or riding one failed, if either did. */
function errorOf(lines: Pending, ride: Pending): Error | null {
  return lines.error ?? ride.error;
}

/** What the leg joins, such as "Photo 3 → 4" or "Photo 1 → Dentetsu-Izumoshi". */
function hopTitle(ends: HopEnd[]): string {
  return ends
    .map(nameOf)
    .join(" → ")
    .replace(/^(Photo \S+) → Photo /, "$1 → ");
}

/** An end's name: its photo's number on the map, or its spot's label. */
function nameOf(end: HopEnd): string {
  if (!end) return "?";
  if ("photo" in end) return `Photo ${end.n}`;
  return end.point.label || "a stop";
}

/** Whether to offer stations to look near: once nothing was found near the photos, or one is picked. */
function picksEnds(finding: boolean, ends: HopEnds, lines: TransitLine[] | undefined): boolean {
  return finding && (hasEnds(ends) || lines?.length === 0);
}

/** Whether a station is picked for either end. */
function hasEnds({ board, alight }: HopEnds): boolean {
  return Boolean(board || alight);
}

/** What the look-up is doing, or what it found when it found none. */
function findNote(finding: boolean, lines: { isFetching: boolean; data?: TransitLine[] }): string {
  if (!finding) return "";
  return lines.isFetching ? ASKING : noneNote(lines.data);
}

/** Said while the look-up runs, since the public servers can be slow. */
const ASKING = "Looking up lines. OpenStreetMap's servers can take up to a minute when busy.";

/** Said when the look-up found no line. */
function noneNote(lines: TransitLine[] | undefined): string {
  return lines?.length === 0 ? NONE_FOUND : "";
}

/** Said when no line passes near both ends. */
const NONE_FOUND =
  "No line of this kind found within 500 m of both ends. If a photo was a walk from the station, pick the station above and it looks again; otherwise the hop stays a straight dashed line.";

interface HopButtonsProps {
  hop: TripSegment;
  busy: boolean;
  onFind: () => void;
  onClear: () => void;
}

/** Finds lines for the hop, and clears the one picked. */
function HopButtons({ hop, busy, onFind, onClear }: HopButtonsProps) {
  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={onFind}>
        {busy ? <Busy busy /> : <Search aria-hidden />}
        {hop.line ? "Change line" : "Find lines"}
      </Button>
      {hop.line && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden />
          Clear
        </Button>
      )}
    </>
  );
}
