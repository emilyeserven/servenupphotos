import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useState } from "react";
import {
  type HopAsk,
  type Spot,
  type TransitLine,
  transitLinesQuery,
  transitTrackMutation,
} from "@/api/transit";
import type { TripSegment, TripTransitLine } from "@/api/trip-lines";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { gapInfo } from "@/components/trip-lines/modes";
import { Button } from "@/components/ui/button";
import type { TripPhoto } from "@/lib/trip-days";
import type { Gap, GapDraft } from "@/lib/trip-gaps";
import { ridesLine, withHopLine } from "@/lib/trip-hop-lines";

interface HopLinesProps {
  photos: TripPhoto[];
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/**
 * The line each train, subway or bus hop rode: Find lines looks up the ones OpenStreetMap maps near
 * both of the hop's photos, and picking one draws the hop along its track, in its color.
 */
export function HopLines({ photos, draft, segments, onChange }: HopLinesProps) {
  const hops = segments.filter(ridesLine);
  if (hops.length === 0) return null;
  const byId = new Map(photos.map((p, i) => [p.id, { photo: p, n: i + 1 }]));
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Lines ridden</h3>
      {hops.map((hop) => (
        <HopRow
          key={`${hop.photos[0]}-${hop.mode}`}
          hop={hop}
          ends={hop.photos.map((id) => byId.get(id))}
          onPick={(picked) => onChange(withHopLine(draft, hop, picked))}
        />
      ))}
    </div>
  );
}

type HopEnd = { photo: TripPhoto; n: number } | undefined;

/** A photo's spot as [longitude, latitude]. */
function spotOf(photo: TripPhoto): Spot {
  return [photo.longitude, photo.latitude];
}

/** What the hop's look-ups ask: its mode and its two photos' spots; none when a photo is missing. */
function askOf(hop: TripSegment, [a, b]: HopEnd[]): HopAsk | undefined {
  if (!a || !b) return undefined;
  return { mode: hop.mode, from: spotOf(a.photo), to: spotOf(b.photo) };
}

interface HopRowProps {
  hop: TripSegment;
  ends: HopEnd[];
  onPick: (picked?: { line: TripTransitLine; path: Spot[] }) => void;
}

/** One hop: which photos it joins, the line it rode, and the lines to pick from once looked up. */
function HopRow({ hop, ends, onPick }: HopRowProps) {
  const { finding, setFinding, lines, track, pick } = useHopLookup(hop, ends, onPick);
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {hopTitle(ends)} by {gapInfo(hop.mode as Gap).label.toLowerCase()}:
        </span>
        <LineBadge line={hop.line} />
        <HopButtons
          hop={hop}
          busy={busyOf(lines, track)}
          onFind={() => setFinding(true)}
          onClear={() => onPick(undefined)}
        />
      </div>
      {finding && <LineChoices lines={lines.data} onPick={pick} disabled={track.isPending} />}
      <SaveNote error={errorOf(lines, track)} why={findNote(finding, lines.data)} />
    </div>
  );
}

/** The hop's look-ups: whether lines are being found, the lines found, and picking one. */
function useHopLookup(hop: TripSegment, ends: HopEnd[], onPick: HopRowProps["onPick"]) {
  const [finding, setFinding] = useState(false);
  const ask = askOf(hop, ends);
  const lines = useQuery({ ...transitLinesQuery(ask!), enabled: finding && ask !== undefined });
  const { track, pick } = usePickLine(ask, (picked) => (onPick(picked), setFinding(false)));
  return { finding, setFinding, lines, track, pick };
}

interface Pending {
  isFetching?: boolean;
  isPending?: boolean;
  error: Error | null;
}

/** Whether the lines are being found or a track fetched. */
function busyOf(lines: Pending, track: Pending): boolean {
  return Boolean(lines.isFetching || track.isPending);
}

/** Why finding lines or fetching a track failed, if either did. */
function errorOf(lines: Pending, track: Pending): Error | null {
  return lines.error ?? track.error;
}

/** Picks a line for the hop: gets its track between the hop's spots, then hands both on. */
function usePickLine(
  ask: HopAsk | undefined,
  onPicked: (picked: { line: TripTransitLine; path: Spot[] }) => void,
) {
  const track = useMutation(transitTrackMutation);
  const pick = (line: TransitLine) =>
    ask &&
    track.mutate(
      { line, from: ask.from, to: ask.to },
      { onSuccess: ({ path }) => onPicked({ line: lineOf(line), path }) },
    );
  return { track, pick };
}

/** The line as a hop keeps it: no kind or ends. */
function lineOf({ id, name, ref, colour }: TransitLine): TripTransitLine {
  return { id, name, ...(ref && { ref }), ...(colour && { colour }) };
}

/** Which photos the hop joins, such as "Photo 3 → 4". */
function hopTitle([a, b]: HopEnd[]): string {
  return `Photo ${numberOf(a)} → ${numberOf(b)}`;
}

/** The photo's number on the map, or "?" when it isn't on the day. */
function numberOf(end: HopEnd): string {
  return end ? String(end.n) : "?";
}

/** What the look-up found, said when it found none. */
function findNote(finding: boolean, lines: TransitLine[] | undefined): string {
  if (!finding || lines === undefined || lines.length > 0) return "";
  return "OpenStreetMap maps no line of this kind near both photos. The hop stays a straight dashed line.";
}

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

/** The line ridden, in its color, or that none is picked. */
function LineBadge({ line }: { line?: TripTransitLine }) {
  if (!line) return <span className="text-muted-foreground italic">no line picked</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className="size-3 rounded-full" style={{ background: line.colour || "#9333ea" }} />
      {line.ref ? `${line.ref} · ${line.name}` : line.name}
    </span>
  );
}

interface LineChoicesProps {
  lines?: TransitLine[];
  disabled: boolean;
  onPick: (line: TransitLine) => void;
}

/** The lines found near both photos, each a button that picks it. */
function LineChoices({ lines = [], disabled, onPick }: LineChoicesProps) {
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
      {lines.map((line) => (
        <li key={line.id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(line)}
            className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm disabled:opacity-50"
          >
            <LineBadge line={line} />
            <span className="text-muted-foreground">{lineEnds(line)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Where the line runs, such as "Nakamozu → Esaka", or its kind when that isn't mapped. */
function lineEnds({ from, to, kind }: TransitLine): string {
  return from && to ? `${from} → ${to}` : kind;
}
