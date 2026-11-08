import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  autoTripLineQuery,
  deleteTripLineMutation,
  saveTripLineMutation,
  type TripFence,
  type TripLine,
  type TripPoint,
  type TripSegment,
} from "@/api/trip-lines";
import { EditorActions, type EditorView } from "@/components/trip-lines/editor-actions";
import { useDayPlaceAreas } from "@/components/trip-lines/use-day-place-areas";
import { newVisit, withVisit } from "@/lib/trip-visits";
import { GroupStrip } from "@/components/trip-lines/group-strip";
import { RouteMap } from "@/components/trip-lines/route-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay, TripPhoto } from "@/lib/trip-days";
import { placeGroups } from "@/lib/trip-groups";
import { draftOf, type GapDraft, segmentsOf, walkingDraft } from "@/lib/trip-gaps";
import { draftVias, movedVia, withVia } from "@/lib/trip-points";
import { useTripDaySearch } from "@/lib/trip-lines-search";
import { isAreaPick, withAreaEnd } from "@/lib/trip-wander";
import { MapTools, type MapPick } from "@/components/trip-lines/route-tools";
import { movedId, orderToSave, orderedPhotos } from "@/lib/trip-order";
import { hasStops, keptStops, type KeptStops, lineStops } from "@/lib/trip-stops-kept";

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
  return { kind: "hand", draft: { ...drawn, ...extras } };
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

/** The automatic line's segments, while the view shows it. */
function autoSegments(view: EditorView, auto: TripLine | undefined): TripSegment[] {
  return (showsAuto(view) && auto?.segments) || [];
}

/** The segments the view draws. */
function viewSegments(ids: number[], view: EditorView, auto: TripLine | undefined): TripSegment[] {
  return view.kind === "hand" ? segmentsOf(ids, view.draft) : autoSegments(view, auto);
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
  const drawn = {
    ...(segments.length > 0 ? draftOf(ids, segments) : walkingDraft(ids)),
    ...lineStops(saved),
  };
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

/**
 * The day's pages the editor shows on: the photo order (the strip alone), the route (the strip and
 * the map with its tools), and the trip stops (the map and the list of places).
 */
export type EditorPart = "order" | "route" | "stops";

interface DayEditorProps {
  day: TripDay;
  line?: TripLine;
  part: EditorPart;
}

/** What each page is called on its card. */
const PART_TITLES: Record<EditorPart, string> = {
  order: "Photo order",
  route: "Route",
  stops: "Trip Stops",
};

/** What each page says the editor is for. */
const PART_NOTES: Record<EditorPart, string> = {
  order:
    "Put the photos in order, cut them into groups by place, and pick what happened between each two: keep walking, a break, or a hop by train, subway, bus or car.",
  route:
    "Pick what happened between each two photos, and shape the line on the map: via points, the day's start and end, transit lines and areas.",
  stops:
    "The stops along the day's route, such as restaurants and shops, with or without a photo, and the casual photos taken there, which show only on the Trip page: add stops on the map, from the saved places or by a coordinate. Put them on the route between two photos in the strip on Photo order or Route.",
};

/** Edits one day's trip line: the photo strip, the map on the Route page, and saving. */
export function DayEditor({ day: taken, line, part }: DayEditorProps) {
  const [view, setRawView] = useState<EditorView>(() => startingView(taken, line));
  // The day with its photos in the view's order: as taken, unless moved by hand.
  const day = { ...taken, photos: orderedPhotos(taken.photos, draftOrder(view)) };
  const ids = day.photos.map((p) => p.id);
  const setView = (next: EditorView) =>
    setRawView(withPlaceGroups(next, orderedPhotos(taken.photos, draftOrder(next))));
  const [hovered, setHovered] = useState<number>();
  const { search, set } = useTripDaySearch();
  const focus = search.group;
  const setFocus = (group: string | undefined) => set({ group });
  const auto = useQuery({ ...autoTripLineQuery(day.day), enabled: showsAuto(view) });
  const segments = viewSegments(ids, view, auto.data);
  const editDraft = (draft: GapDraft) => setView({ kind: "hand", draft });
  const placeAreas = useDayPlaceAreas(day.photos);
  const shownDraft = stripDraft(view, day.photos, segments, line);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{PART_TITLES[part]}</CardTitle>
        <CardDescription>
          {day.photos.length} photos at {day.spots} spots. {PART_NOTES[part]}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {part !== "stops" && (
          <GroupStrip
            photos={day.photos}
            draft={shownDraft}
            onChange={editDraft}
            onMove={(id, by) => editDraft({ ...shownDraft, order: movedId(ids, id, by) })}
            onHover={setHovered}
            focus={focus}
            onFocus={setFocus}
            stacked={part === "order"}
          />
        )}
        {part !== "order" && (
          <DayMap
            day={day}
            part={part}
            view={view}
            shown={shownDraft}
            segments={segments}
            highlighted={hovered}
            focus={focus}
            placeAreas={placeAreas}
            onChange={editDraft}
          />
        )}
        <DayActions
          day={day}
          ids={ids}
          view={view}
          setView={setView}
          auto={auto}
          segments={segments}
          order={orderToSave(taken.photos, ids)}
          saved={line}
        />
      </CardContent>
    </Card>
  );
}

interface DayMapProps extends Omit<HandMapProps, "draft"> {
  view: EditorView;
  /** The draft the strip shows, which adding a trip stop starts a hand-drawn line from. */
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
}

/**
 * The map of a line drawn by hand, with the page's tools: the route's, or the trip stops.
 * Clicking the map places the spot being picked, or adds a via point while adding them.
 */
function HandMap(props: HandMapProps) {
  const { day, draft, segments, highlighted, focus, placeAreas, onChange, part } = props;
  const [picking, setPicking] = useState<MapPick>();
  const [addingVia, setAddingVia] = useState(false);
  const pick = (point: TripPoint) => {
    onChange(picked(draft, picking, point, () => withVia(draft, segments, day.photos, point)));
    setPicking(undefined);
  };
  return (
    <>
      <RouteMap
        day={day.day}
        photos={day.photos}
        segments={segments}
        preview={false}
        highlighted={highlighted}
        focus={focus}
        ends={endsOf(segments)}
        onPick={picking || addingVia ? pick : undefined}
        vias={draftVias(draft)}
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
        onPicking={setPicking}
        addingVia={addingVia}
        onAddingVia={setAddingVia}
      />
    </>
  );
}

/** A line with its route removed and its trip stops kept: by hand, with nothing drawn. */
function stopsOnly(): Pick<TripLine, "auto" | "planned" | "segments"> {
  return { auto: false, planned: true, segments: [] };
}

/**
 * How a line drawn by hand is saved: by hand, and planned ahead while its day has no photos yet,
 * so its trip stops wait for them.
 */
function plannedOf(ids: number[]): Pick<TripLine, "auto" | "planned"> {
  return ids.length === 0 ? { auto: false, planned: true } : { auto: false };
}

/** The trip stops and areas in a hand-drawn view, as the line file lists them; none otherwise. */
function extrasOf(view: EditorView): KeptStops {
  return view.kind === "hand" ? lineStops(view.draft) : {};
}

interface DayActionsProps {
  day: TripDay;
  ids: number[];
  view: EditorView;
  setView: (view: EditorView) => void;
  auto: { data?: TripLine; isFetching: boolean; error: Error | null };
  segments: TripSegment[];
  /** The photo order moved into by hand, to save with the line; none while it's as taken. */
  order?: number[];
  saved?: TripLine;
}

/** The buttons under the map, which save and remove the line as changes waiting for Commit. */
function DayActions(props: DayActionsProps) {
  const { day, ids, view, setView, auto, segments, order, saved } = props;
  const save = useMutation(saveTripLineMutation);
  const remove = useMutation(deleteTripLineMutation);
  const base = { id: day.day, day: day.day };
  return (
    <EditorActions
      view={view}
      saved={saved !== undefined}
      autoError={auto.error}
      autoBusy={auto.isFetching}
      save={save}
      remove={remove}
      onSaveHand={() =>
        save.mutate({
          ...base,
          ...plannedOf(ids),
          segments,
          ...extrasOf(view),
          ...(order && { order }),
        })
      }
      onTurnOnAuto={() =>
        save.mutate(
          { ...base, auto: true, segments: [], ...keptStops(view, saved) },
          { onSuccess: () => setView({ kind: "auto" }) },
        )
      }
      onRemove={() => {
        const stops = keptStops(view, saved);
        const done = { onSuccess: () => setView({ kind: "none" }) };
        // With trip stops, the route goes but they stay, as a line with none drawn.
        if (hasStops(stops)) save.mutate({ ...base, ...stopsOnly(), ...stops }, done);
        else remove.mutate(day.day, done);
      }}
      onEditOwn={() =>
        setView({
          kind: "hand",
          draft: { ...draftOf(ids, auto.data?.segments ?? []), ...lineStops(saved) },
        })
      }
      setView={setView}
      ids={ids}
    />
  );
}
