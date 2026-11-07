import type { TripSegment } from "@/api/trip-lines";
import { AreaEnds } from "@/components/trip-lines/area-ends";
import { type EndKey, EndSpots } from "@/components/trip-lines/end-spots";
import { Fences } from "@/components/trip-lines/fences";
import { HopLines } from "@/components/trip-lines/hop-lines";
import { ShapeTools } from "@/components/trip-lines/shape-tools";
import { Visits } from "@/components/trip-lines/visits";
import type { TripDay } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";
import { type AreaPick, isAreaPick } from "@/lib/trip-wander";

/** What a click on the map places: the day's start or end spot, or a place visited. */
export type MapPick = EndKey | "visit" | AreaPick;

/** The start or end spot being picked, if that's what is. */
function endPicking(picking: MapPick | undefined): EndKey | undefined {
  return picking === "start" || picking === "end" ? picking : undefined;
}

/** The entrance or exit of an area wandered being picked, if that's what is. */
function areaPicking(picking: MapPick | undefined): AreaPick | undefined {
  return isAreaPick(picking) ? picking : undefined;
}

interface RouteToolsProps {
  day: TripDay;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
  /** What a click on the map places now, if anything. */
  picking?: MapPick;
  onPicking: (picking: MapPick | undefined) => void;
  /** Whether a click on the map adds a via point. */
  addingVia: boolean;
  onAddingVia: (on: boolean) => void;
}

/**
 * The tools under the map for the page it's on: the places visited on the Places page, or else the
 * route's.
 */
export function MapTools({
  part,
  ...props
}: RouteToolsProps & { part: "order" | "route" | "places" }) {
  if (part !== "places") return <RouteTools {...props} />;
  return (
    <Visits
      day={props.day}
      draft={props.draft}
      onChange={props.onChange}
      picking={props.picking === "visit"}
      onPicking={(on) => props.onPicking(on ? "visit" : undefined)}
    />
  );
}

/**
 * The Route page's tools under the map: shaping and snapping the line, the lines ridden, the day's
 * start and end, the ends of areas wandered, and the areas photos were taken in.
 */
function RouteTools(props: RouteToolsProps) {
  const { day, draft, segments, onChange, picking, onPicking } = props;
  return (
    <>
      <ShapeTools
        day={day.day}
        draft={draft}
        segments={segments}
        onChange={onChange}
        addingVia={props.addingVia}
        onAddingVia={props.onAddingVia}
      />
      <HopLines photos={day.photos} draft={draft} segments={segments} onChange={onChange} />
      <EndSpots
        draft={draft}
        onChange={onChange}
        picking={endPicking(picking)}
        onPicking={onPicking}
      />
      <AreaEnds
        ids={day.photos.map((p) => p.id)}
        draft={draft}
        onChange={onChange}
        picking={areaPicking(picking)}
        onPicking={onPicking}
      />
      <Fences day={day} draft={draft} onChange={onChange} />
    </>
  );
}
