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
import { type EndKey, EndSpots } from "@/components/trip-lines/end-spots";
import { HopLines } from "@/components/trip-lines/hop-lines";
import { Fences } from "@/components/trip-lines/fences";
import { useDayPlaceAreas } from "@/components/trip-lines/use-day-place-areas";
import { Visits } from "@/components/trip-lines/visits";
import { newVisit, withVisit } from "@/lib/trip-visits";
import { GroupStrip } from "@/components/trip-lines/group-strip";
import { RouteMap } from "@/components/trip-lines/route-map";
import { ShapeTools } from "@/components/trip-lines/shape-tools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay, TripPhoto } from "@/lib/trip-days";
import { placeGroups } from "@/lib/trip-groups";
import { draftOf, type GapDraft, segmentsOf, walkingDraft } from "@/lib/trip-gaps";
import { draftVias, movedVia, withVia } from "@/lib/trip-points";
import { dayTitle } from "@/components/trip-lines/day-title";
import { useTripLinesSearch } from "@/lib/trip-lines-search";

/** What the editor shows first: the saved line by hand, the automatic line, or nothing yet. */
function initialView(ids: number[], line: TripLine | undefined): EditorView {
  if (!line) return { kind: "none" };
  if (line.auto) return { kind: "auto" };
  const extras = { visits: line.visits, fences: line.fences };
  return { kind: "hand", draft: { ...draftOf(ids, line.segments), ...extras } };
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
function stripDraft(view: EditorView, photos: TripPhoto[], segments: TripSegment[]): GapDraft {
  if (view.kind === "hand") return view.draft;
  const ids = photos.map((p) => p.id);
  const drawn = segments.length > 0 ? draftOf(ids, segments) : walkingDraft(ids);
  return drawn.groups === undefined ? { ...drawn, ...placeGroups(photos) } : drawn;
}

/** The spots with no photo the view draws. */
function endsOf(segments: TripSegment[]): TripPoint[] {
  return segments.flatMap((s) =>
    [s.start, s.end, s.board, s.alight].filter((p) => p !== undefined),
  );
}

/** Edits one day's trip line: the photo strip, the map, and saving. */
export function DayEditor({ day, line }: { day: TripDay; line?: TripLine }) {
  const ids = day.photos.map((p) => p.id);
  const [view, setRawView] = useState<EditorView>(() =>
    withPlaceGroups(initialView(ids, line), day.photos),
  );
  const setView = (next: EditorView) => setRawView(withPlaceGroups(next, day.photos));
  const [hovered, setHovered] = useState<number>();
  const { search, set } = useTripLinesSearch();
  const focus = search.group;
  const setFocus = (group: string | undefined) => set({ group });
  const auto = useQuery({ ...autoTripLineQuery(day.day), enabled: showsAuto(view) });
  const segments = viewSegments(ids, view, auto.data);
  const editDraft = (draft: GapDraft) => setView({ kind: "hand", draft });
  const draft = view.kind === "hand" ? view.draft : undefined;
  const placeAreas = useDayPlaceAreas(day.photos);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{dayTitle(day.day)}</CardTitle>
        <CardDescription>
          {day.photos.length} photos at {day.spots} spots. Pick what happened between each two
          photos: keep walking, a break, or a hop by train, subway, bus or car.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <GroupStrip
          photos={day.photos}
          draft={stripDraft(view, day.photos, segments)}
          onChange={editDraft}
          onHover={setHovered}
          focus={focus}
          onFocus={setFocus}
        />
        {draft ? (
          <HandMap
            day={day}
            draft={draft}
            segments={segments}
            highlighted={hovered}
            focus={focus}
            placeAreas={placeAreas}
            onChange={editDraft}
          />
        ) : (
          <RouteMap
            day={day.day}
            photos={day.photos}
            segments={segments}
            preview={view.kind === "preview"}
            highlighted={hovered}
            focus={focus}
            ends={endsOf(segments)}
            fences={placeAreas}
          />
        )}
        <DayActions
          day={day}
          ids={ids}
          view={view}
          setView={setView}
          auto={auto}
          segments={segments}
          saved={line}
        />
      </CardContent>
    </Card>
  );
}

/** What a click on the map places: the day's start or end spot, or a place visited. */
type MapPick = EndKey | "visit";

/** The start or end spot being picked, if that's what is. */
function endPicking(picking: MapPick | undefined): EndKey | undefined {
  return picking === "visit" ? undefined : picking;
}

/** The draft with the clicked point placed as picking says, or else as a via point. */
function picked(
  draft: GapDraft,
  picking: MapPick | undefined,
  point: TripPoint,
  via: () => GapDraft,
): GapDraft {
  if (picking === "visit") return withVisit(draft, newVisit(point));
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
}

/**
 * The map of a line drawn by hand, with its tools: clicking the map places the spot being picked,
 * or adds a via point while adding them.
 */
function HandMap({ day, draft, segments, highlighted, focus, placeAreas, onChange }: HandMapProps) {
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
      <ShapeTools
        day={day.day}
        draft={draft}
        segments={segments}
        onChange={onChange}
        addingVia={addingVia}
        onAddingVia={setAddingVia}
      />
      <HopLines photos={day.photos} draft={draft} segments={segments} onChange={onChange} />
      <EndSpots
        draft={draft}
        onChange={onChange}
        picking={endPicking(picking)}
        onPicking={setPicking}
      />
      <Visits
        day={day}
        draft={draft}
        onChange={onChange}
        picking={picking === "visit"}
        onPicking={(on) => setPicking(on ? "visit" : undefined)}
      />
      <Fences day={day} draft={draft} onChange={onChange} />
    </>
  );
}

/** The places visited and areas in a hand-drawn view, as the line file lists them; none otherwise. */
function extrasOf(view: EditorView): Pick<TripLine, "visits" | "fences"> {
  if (view.kind !== "hand") return {};
  const { visits = [], fences = [] } = view.draft;
  return { ...(visits.length > 0 && { visits }), ...(fences.length > 0 && { fences }) };
}

interface DayActionsProps {
  day: TripDay;
  ids: number[];
  view: EditorView;
  setView: (view: EditorView) => void;
  auto: { data?: TripLine; isFetching: boolean; error: Error | null };
  segments: TripSegment[];
  saved?: TripLine;
}

/** The buttons under the map, which save and remove the line as changes waiting for Commit. */
function DayActions({ day, ids, view, setView, auto, segments, saved }: DayActionsProps) {
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
      onSaveHand={() => save.mutate({ ...base, auto: false, segments, ...extrasOf(view) })}
      onTurnOnAuto={() =>
        save.mutate(
          { ...base, auto: true, segments: [] },
          { onSuccess: () => setView({ kind: "auto" }) },
        )
      }
      onRemove={() => remove.mutate(day.day, { onSuccess: () => setView({ kind: "none" }) })}
      onEditOwn={() => setView({ kind: "hand", draft: draftOf(ids, auto.data?.segments ?? []) })}
      setView={setView}
      ids={ids}
    />
  );
}
