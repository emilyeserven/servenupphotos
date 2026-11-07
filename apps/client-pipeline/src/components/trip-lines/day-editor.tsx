import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  autoTripLineQuery,
  deleteTripLineMutation,
  saveTripLineMutation,
  type TripLine,
  type TripPoint,
  type TripSegment,
} from "@/api/trip-lines";
import { EditorActions, type EditorView } from "@/components/trip-lines/editor-actions";
import { type EndKey, EndSpots } from "@/components/trip-lines/end-spots";
import { HopLines } from "@/components/trip-lines/hop-lines";
import { PhotoStrip } from "@/components/trip-lines/photo-strip";
import { RouteMap } from "@/components/trip-lines/route-map";
import { ShapeTools } from "@/components/trip-lines/shape-tools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay } from "@/lib/trip-days";
import { draftOf, type Gap, type GapDraft, segmentsOf } from "@/lib/trip-gaps";
import { draftVias, movedVia, withVia } from "@/lib/trip-points";
import { dayTitle } from "@/components/trip-lines/day-title";

/** What the editor shows first: the saved line by hand, the automatic line, or nothing yet. */
function initialView(ids: number[], line: TripLine | undefined): EditorView {
  if (!line) return { kind: "none" };
  if (line.auto) return { kind: "auto" };
  return { kind: "hand", draft: draftOf(ids, line.segments) };
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

/** The gaps the strip shows: the draft's, or else the drawn segments' as gaps; none with no line. */
function stripGaps(ids: number[], view: EditorView, segments: TripSegment[]): Gap[] | undefined {
  if (view.kind === "hand") return view.draft.gaps;
  return segments.length > 0 ? draftOf(ids, segments).gaps : undefined;
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
  const [view, setView] = useState<EditorView>(() => initialView(ids, line));
  const [hovered, setHovered] = useState<number>();
  const auto = useQuery({ ...autoTripLineQuery(day.day), enabled: showsAuto(view) });
  const segments = viewSegments(ids, view, auto.data);
  const editDraft = (draft: GapDraft) => setView({ kind: "hand", draft });
  const draft = view.kind === "hand" ? view.draft : undefined;
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
        <PhotoStrip
          photos={day.photos}
          gaps={stripGaps(ids, view, segments)}
          onHover={setHovered}
          onGap={draft && ((i, gap) => editDraft(withGap(draft, i, gap)))}
        />
        {draft ? (
          <HandMap
            day={day}
            draft={draft}
            segments={segments}
            highlighted={hovered}
            onChange={editDraft}
          />
        ) : (
          <RouteMap
            day={day.day}
            photos={day.photos}
            segments={segments}
            preview={view.kind === "preview"}
            highlighted={hovered}
            ends={endsOf(segments)}
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

interface HandMapProps {
  day: TripDay;
  draft: GapDraft;
  segments: TripSegment[];
  highlighted?: number;
  onChange: (draft: GapDraft) => void;
}

/**
 * The map of a line drawn by hand, with its tools: clicking the map places the spot being picked,
 * or adds a via point while adding them.
 */
function HandMap({ day, draft, segments, highlighted, onChange }: HandMapProps) {
  const [picking, setPicking] = useState<EndKey>();
  const [addingVia, setAddingVia] = useState(false);
  const pick = (point: TripPoint) => {
    onChange(
      picking ? { ...draft, [picking]: point } : withVia(draft, segments, day.photos, point),
    );
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
        ends={endsOf(segments)}
        onPick={picking || addingVia ? pick : undefined}
        vias={draftVias(draft)}
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
      <EndSpots draft={draft} onChange={onChange} picking={picking} onPicking={setPicking} />
    </>
  );
}

/** The draft with gap index changed. */
function withGap(draft: GapDraft, index: number, gap: Gap): GapDraft {
  return { ...draft, gaps: draft.gaps.map((g, i) => (i === index ? gap : g)) };
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
      onSaveHand={() => save.mutate({ ...base, auto: false, segments })}
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
