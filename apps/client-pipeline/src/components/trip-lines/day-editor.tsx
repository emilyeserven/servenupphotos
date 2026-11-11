import { useQuery } from "@tanstack/react-query";
import { Rows3 } from "lucide-react";
import { useRef, useState } from "react";
import {
  autoTripLineQuery,
  type TripFence,
  type TripLine,
  type TripPoint,
  type TripSegment,
} from "@/api/trip-lines";
import {
  type EditorView,
  type LineMode,
  LineSwitch,
  SaveBar,
} from "@/components/trip-lines/editor-actions";
import { useDaySave, useLeaveGuard } from "@/components/trip-lines/day-save";
import { editedView, modeView } from "@/lib/trip-line-view";
import { type EndKey, PickHint } from "@/components/trip-lines/end-spots";
import { useDayPlaceAreas } from "@/components/trip-lines/use-day-place-areas";
import { newVisit, withVisit } from "@/lib/trip-visits";
import { GroupStrip } from "@/components/trip-lines/group-strip";
import { stripVias } from "@/components/trip-lines/via-list";
import { RouteMap } from "@/components/trip-lines/route-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { TripDay, TripPhoto } from "@/lib/trip-days";
import { placeGroups } from "@/lib/trip-groups";
import { draftOf, type GapDraft, segmentsOf, walkingDraft, withStops } from "@/lib/trip-gaps";
import { movedVia, withVia } from "@/lib/trip-points";
import { viasInRouteOrder } from "@/lib/via-order";
import { useTripDaySearch } from "@/lib/trip-lines-search";
import { isAreaPick, withAreaEnd } from "@/lib/trip-wander";
import { MapTools, type MapPick } from "@/components/trip-lines/route-tools";
import { movedId, orderToSave, orderedPhotos } from "@/lib/trip-order";
import { keptStops, type KeptStops, withStopVias } from "@/lib/trip-stops-kept";

/**
 * What the editor shows first: the saved line by hand, the automatic line, or nothing yet. A day
 * planned before its photos starts as walking through any photos it has since, with its trip stops.
 */
function initialView(ids: number[], line: TripLine | undefined): EditorView {
  if (!line) return { kind: "none" };
  return line.auto ? { kind: "auto" } : handView(ids, line);
}

/**
 * A line saved by hand as the editor starts it. One with trip stops and no route (planned ahead,
 * or with its route removed) shows no line while its day has photos, its stops kept; with no
 * photos yet, it's a draft to add stops to.
 */
function handView(ids: number[], line: TripLine): EditorView {
  if (line.planned && ids.length > 0) return { kind: "none" };
  const extras = { visits: line.visits, fences: line.fences, order: line.order };
  const drawn = line.planned ? walkingDraft(ids) : draftOf(ids, line.segments);
  return { kind: "hand", draft: withStops({ ...drawn, ...extras }, ids.at(-1)) };
}

/** The view, with a hand-drawn draft that has no groups yet grouped by its photos' places. */
function withPlaceGroups(view: EditorView, photos: TripPhoto[]): EditorView {
  if (view.kind !== "hand" || view.draft.groups !== undefined) return view;
  return { ...view, draft: { ...view.draft, ...placeGroups(photos) } };
}

/** Whether the view draws the automatic line, which the backend works out. */
function showsAuto(view: EditorView): boolean {
  return view.kind === "preview" || view.kind === "auto";
}

/** The automatic line's segments, while the view shows it, through the trip stops put on it. */
function autoSegments(
  view: EditorView,
  auto: TripLine | undefined,
  stops: KeptStops,
): TripSegment[] {
  return withStopVias((showsAuto(view) && auto?.segments) || [], stops.visits);
}

/** The segments the view draws; saved is the day's line file, whose trip stops the automatic line passes through. */
function viewSegments(
  ids: number[],
  view: EditorView,
  auto: TripLine | undefined,
  saved: TripLine | undefined,
): TripSegment[] {
  if (view.kind === "hand") return segmentsOf(ids, view.draft);
  return autoSegments(view, auto, keptStops(view, saved));
}

/**
 * The draft the group strip shows: the hand-drawn one, or else the drawn segments (walking all day
 * with no line yet) grouped by place, so the groups show before drawing by hand. Changing it starts
 * a hand-drawn line from it.
 */
function stripDraft(
  view: EditorView,
  photos: TripPhoto[],
  segments: TripSegment[],
  saved: TripLine | undefined,
): GapDraft {
  if (view.kind === "hand") return view.draft;
  const ids = photos.map((p) => p.id);
  const drawn = withStops(
    {
      ...(segments.length > 0 ? draftOf(ids, segments) : walkingDraft(ids)),
      ...keptStops(view, saved),
    },
    ids.at(-1),
  );
  return drawn.groups === undefined ? { ...drawn, ...placeGroups(photos) } : drawn;
}

/** The spots with no photo the view draws. */
function endsOf(segments: TripSegment[]): TripPoint[] {
  return segments.flatMap((s) =>
    [s.start, s.end, s.board, s.alight, s.from, s.to].filter((p) => p !== undefined),
  );
}

/** The order the view's photos were moved into by hand, when it's a hand-drawn line with one. */
function draftOrder(view: EditorView): number[] | undefined {
  return view.kind === "hand" ? view.draft.order : undefined;
}

/** The view to start with: the saved line, its photos in the order it saved, grouped by place. */
function startingView(day: TripDay, line: TripLine | undefined): EditorView {
  const photos = orderedPhotos(day.photos, line?.order);
  return withPlaceGroups(
    initialView(
      photos.map((p) => p.id),
      line,
    ),
    photos,
  );
}

/** The day's pages the editor shows on: the route (the strip, the map and its tools) and the trip stops. */
export type EditorPart = "route" | "stops";

interface DayEditorProps {
  day: TripDay;
  line?: TripLine;
  part: EditorPart;
}

/** What each page says the editor is for. */
const PART_NOTES: Record<EditorPart, string> = {
  route: "Put the photos in order and into groups, and draw the day's line through them.",
  stops:
    "Restaurants, shops and other stops along the day, with or without a photo, and the casual photos taken there. Each one's Where on the route menu puts it on the line.",
};

/** The start or end spot being picked on the map, if that's what is. */
function endPicking(picking: MapPick | undefined): EndKey | undefined {
  return picking === "start" || picking === "end" ? picking : undefined;
}

/**
 * Edits one day's trip line: the line switch and photo strip on the Route page, the map with the
 * page's tools, and the save bar under them.
 */
export function DayEditor({ day: taken, line, part }: DayEditorProps) {
  const [view, setRawView] = useState<EditorView>(() => startingView(taken, line));
  const [dirty, setDirty] = useState(false);
  // The line by hand last shown, so switching to another kind of line and back keeps it.
  const lastHand = useRef<GapDraft>(undefined);
  // The day with its photos in the view's order: as taken, unless moved by hand.
  const day = { ...taken, photos: orderedPhotos(taken.photos, draftOrder(view)) };
  const ids = day.photos.map((p) => p.id);
  const show = (next: EditorView, changed = true) => {
    if (view.kind === "hand") lastHand.current = view.draft;
    setRawView(withPlaceGroups(next, orderedPhotos(taken.photos, draftOrder(next))));
    setDirty(changed);
  };
  const [hovered, setHovered] = useState<number>();
  const [picking, setPicking] = useState<MapPick>();
  const { search, set } = useTripDaySearch();
  const auto = useQuery({ ...autoTripLineQuery(day.day), enabled: showsAuto(view) });
  const segments = viewSegments(ids, view, auto.data, line);
  const placeAreas = useDayPlaceAreas(day.photos);
  const shownDraft = stripDraft(view, day.photos, segments, line);
  const editDraft = (draft: GapDraft) => show(editedView(view, shownDraft, draft));
  const onMode = (mode: LineMode) =>
    show(modeView(mode, { view, ids, saved: line, auto: auto.data, lastHand: lastHand.current }));
  // Setting a spot with no photo draws the line by hand, so the map can be clicked.
  const pickSpot = (which: EndKey) => {
    if (view.kind !== "hand") show({ kind: "hand", draft: shownDraft });
    setPicking(which);
  };
  const { save, remove, run } = useDaySave({
    day: day.day,
    ids,
    view,
    segments,
    order: orderToSave(taken.photos, ids),
    saved: line,
    refetchAuto: auto.refetch,
    onSaved: (next) => show(next, false),
  });
  useLeaveGuard(day.day, dirty);
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardDescription>
            {day.photos.length} photos at {day.spots} spots. {PART_NOTES[part]}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {part === "route" && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <LineSwitch view={view} onMode={onMode} autoBusy={auto.isFetching} />
                <StackButton
                  on={search.stack === true}
                  onToggle={(on) => set({ stack: on || undefined })}
                />
              </div>
              <GroupStrip
                photos={day.photos}
                draft={shownDraft}
                onChange={editDraft}
                onMove={(id, by) => editDraft({ ...shownDraft, order: movedId(ids, id, by) })}
                onHover={setHovered}
                focus={search.group}
                onFocus={(group) => set({ group })}
                stacked={search.stack === true}
                vias={stripVias(day, shownDraft, segments)}
                spots={{ picking: endPicking(picking), onPick: pickSpot }}
              />
            </>
          )}
          <DayMap
            day={day}
            part={part}
            view={view}
            shown={shownDraft}
            segments={segments}
            highlighted={hovered}
            focus={search.group}
            placeAreas={placeAreas}
            onChange={editDraft}
            picking={picking}
            onPicking={setPicking}
          />
        </CardContent>
      </Card>
      <SaveBar
        view={view}
        dirty={dirty}
        saved={line}
        autoError={auto.error}
        autoBusy={auto.isFetching}
        save={save}
        remove={remove}
        onSave={run}
      />
    </div>
  );
}

/** Lays the photo strip's groups out top to bottom, with what happened between them in between. */
function StackButton({ on, onToggle }: { on: boolean; onToggle: (on: boolean) => void }) {
  return (
    <Button
      variant={on ? "secondary" : "outline"}
      size="sm"
      aria-pressed={on}
      onClick={() => onToggle(!on)}
    >
      <Rows3 aria-hidden />
      Stack groups
    </Button>
  );
}

interface DayMapProps extends Omit<HandMapProps, "draft"> {
  view: EditorView;
  /** The draft the strip shows, which adding a trip stop starts from. */
  shown: GapDraft;
}

/**
 * The day's map: with its tools while the line is drawn by hand or on the Trip Stops page, or else as
 * it's drawn.
 */
function DayMap({ view, shown, ...props }: DayMapProps) {
  if (view.kind === "hand") return <HandMap {...props} draft={view.draft} />;
  if (props.part === "stops") return <HandMap {...props} draft={shown} />;
  const { day, segments, highlighted, focus, placeAreas } = props;
  return (
    <RouteMap
      day={day.day}
      photos={day.photos}
      segments={segments}
      preview={view.kind === "preview"}
      highlighted={highlighted}
      focus={focus}
      ends={endsOf(segments)}
      visits={shown.visits}
      fences={[...(shown.fences ?? []), ...placeAreas]}
    />
  );
}

/** The draft with the clicked point placed as picking says, or else as a via point. */
function picked(
  draft: GapDraft,
  picking: MapPick | undefined,
  point: TripPoint,
  via: () => GapDraft,
): GapDraft {
  if (picking === "visit") return withVisit(draft, newVisit(point));
  if (isAreaPick(picking)) return withAreaEnd(draft, picking, point);
  return picking ? { ...draft, [picking]: point } : via();
}

interface HandMapProps {
  day: TripDay;
  draft: GapDraft;
  segments: TripSegment[];
  highlighted?: number;
  /** The name of the group shown on its own, the others faded. */
  focus?: string;
  /** The areas of the day's places, shaded under the line. */
  placeAreas: TripFence[];
  onChange: (draft: GapDraft) => void;
  /** The page the map is on, which picks its tools. */
  part: EditorPart;
  /** What a click on the map places now, if anything; the photo strip's start and end set it too. */
  picking?: MapPick;
  onPicking: (picking: MapPick | undefined) => void;
}

/**
 * The map of a line drawn by hand, with the page's tools: the route's, or the trip stops.
 * Clicking the map places the spot being picked, or adds a via point while adding them.
 */
function HandMap(props: HandMapProps) {
  const { day, draft, segments, highlighted, focus, placeAreas, onChange, part } = props;
  const { picking, onPicking } = props;
  const [addingVia, setAddingVia] = useState(false);
  const pick = (point: TripPoint) => {
    onChange(picked(draft, picking, point, () => withVia(draft, segments, day.photos, point)));
    onPicking(undefined);
  };
  return (
    <>
      <PickHint picking={endPicking(picking)} onCancel={() => onPicking(undefined)} />
      <RouteMap
        day={day.day}
        photos={day.photos}
        segments={segments}
        preview={false}
        highlighted={highlighted}
        focus={focus}
        ends={endsOf(segments)}
        onPick={picking || addingVia ? pick : undefined}
        vias={viasInRouteOrder(draft, segments)}
        visits={draft.visits}
        fences={[...(draft.fences ?? []), ...placeAreas]}
        onMoveVia={(key, i, point) => onChange(movedVia(draft, key, i, point))}
      />
      <MapTools
        part={part}
        day={day}
        draft={draft}
        segments={segments}
        onChange={onChange}
        picking={picking}
        onPicking={onPicking}
        addingVia={addingVia}
        onAddingVia={setAddingVia}
      />
    </>
  );
}
