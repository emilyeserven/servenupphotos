import { useMutation } from "@tanstack/react-query";
import { Route, Spline } from "lucide-react";
import { routeTripLineMutation, type TripSegment } from "@/api/trip-lines";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { type GapDraft, pathsOf } from "@/lib/trip-gaps";

interface ShapeToolsProps {
  day: string;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
  /** Whether map clicks add via points. */
  addingVia: boolean;
  onAddingVia: (on: boolean) => void;
}

/** Whether a segment follows streets once snapped: a walk, bus ride or drive. */
function followsStreets(segment: TripSegment): boolean {
  return segment.mode === "walk" || segment.mode === "bus" || segment.mode === "car";
}

/** How many segments that follow streets aren't snapped yet. */
function unsnapped(segments: TripSegment[]): number {
  return segments.filter((s) => followsStreets(s) && !s.path).length;
}

/** What the snap said: how many stretches got no route, or that all of them are snapped. */
function snapNote(segments: TripSegment[], unrouted: number | undefined): string {
  if (unrouted)
    return `${unrouted} stretch(es) got no route from OpenStreetMap, so they stay straight.`;
  const left = unsnapped(segments);
  return left > 0
    ? `${left} walk, bus or car stretch(es) are straight. Add via points to shape them, then snap them to streets.`
    : "Every walk, bus or car stretch follows the streets.";
}

/**
 * Shapes the line: via points added by clicking the map bend it, and Snap to streets asks the
 * OpenStreetMap routing servers for the path along streets through them, without saving.
 */
export function ShapeTools({
  day,
  draft,
  segments,
  onChange,
  addingVia,
  onAddingVia,
}: ShapeToolsProps) {
  const route = useMutation(routeTripLineMutation);
  const snap = () =>
    route.mutate(
      // The trip stops go along, since a segment's via spots can stand for them.
      { id: day, day, auto: false, segments, visits: draft.visits },
      {
        onSuccess: ({ line }) =>
          onChange({ ...draft, paths: { ...draft.paths, ...pathsOf(line.segments) } }),
      },
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ViaToggle addingVia={addingVia} onAddingVia={onAddingVia} />
        <Button
          variant="outline"
          size="sm"
          disabled={route.isPending || unsnapped(segments) === 0}
          onClick={snap}
        >
          {route.isPending ? <Busy busy /> : <Route aria-hidden />}
          Snap to streets
        </Button>
      </div>
      <SaveNote error={route.error} why={toolsNote(addingVia, segments, route.data?.unrouted)} />
    </div>
  );
}

/** The note under the tools: how to place via points while adding them, else what the snap said. */
function toolsNote(addingVia: boolean, segments: TripSegment[], unrouted?: number): string {
  if (addingVia)
    return "Click the map to bend the line through a spot. Drag a via point to move it, or click it to remove it.";
  return snapNote(segments, unrouted);
}

/** The button that turns adding via points by clicking the map on and off. */
function ViaToggle({ addingVia, onAddingVia }: Pick<ShapeToolsProps, "addingVia" | "onAddingVia">) {
  return (
    <Button
      variant={addingVia ? "secondary" : "outline"}
      size="sm"
      onClick={() => onAddingVia(!addingVia)}
    >
      <Spline aria-hidden />
      {addingVia ? "Done adding via points" : "Add via points"}
    </Button>
  );
}
