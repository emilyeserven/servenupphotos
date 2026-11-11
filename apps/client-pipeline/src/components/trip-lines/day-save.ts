import { useMutation } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import {
  deleteTripLineMutation,
  saveTripLineMutation,
  type TripLine,
  type TripSegment,
} from "@/api/trip-lines";
import type { EditorView } from "@/components/trip-lines/editor-actions";
import type { GapDraft } from "@/lib/trip-gaps";
import { hasStops, keptStops, type KeptStops, lineStops } from "@/lib/trip-stops-kept";

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

interface DaySaveProps {
  day: string;
  ids: number[];
  view: EditorView;
  /** The segments the view draws, saved for a line by hand. */
  segments: TripSegment[];
  /** The photo order moved into by hand, to save with the line; none while it's as taken. */
  order?: number[];
  saved?: TripLine;
  /** Works the automatic line out again once it's saved. */
  refetchAuto: () => Promise<unknown>;
  /** Shows the view as saved, with no changes left. */
  onSaved: (view: EditorView) => void;
}

/**
 * Saving the day as the view shows it, as a change waiting for Commit: the line by hand, the
 * automatic line (turned on or drawn again), or no line, which removes the route and keeps any
 * trip stops as a line with none drawn.
 */
export function useDaySave(props: DaySaveProps) {
  const { day, ids, view, segments, order, saved, refetchAuto, onSaved } = props;
  const save = useMutation(saveTripLineMutation);
  const remove = useMutation(deleteTripLineMutation);
  const base = { id: day, day, ...(order && { order }) };
  const stops: KeptStops = keptStops(view, saved);
  const saveHand = (draft: GapDraft) => {
    const line = { ...base, ...plannedOf(ids), segments, ...lineStops(draft) };
    save.mutate(line, { onSuccess: () => onSaved(view) });
  };
  const saveAuto = () => {
    const done = () => void refetchAuto().then(() => onSaved({ kind: "auto" }));
    save.mutate({ ...base, auto: true, segments: [], ...stops }, { onSuccess: done });
  };
  const saveNone = () => {
    const done = { onSuccess: () => onSaved({ kind: "none" }) };
    // With trip stops, the route goes but they stay, as a line with none drawn.
    if (hasStops(stops)) save.mutate({ ...base, ...stopsOnly(), ...stops }, done);
    else if (saved) remove.mutate(day, done);
    else onSaved({ kind: "none" });
  };
  const run = () => {
    if (view.kind === "hand") saveHand(view.draft);
    else if (view.kind === "none") saveNone();
    else saveAuto();
  };
  return { save, remove, run };
}

/**
 * Asks before leaving the day with changes not saved yet, such as by **Every day**, the sidebar or
 * closing the tab. Moving between the day's own pages keeps the changes, so it doesn't ask.
 */
export function useLeaveGuard(day: string, dirty: boolean) {
  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: () => dirty,
    shouldBlockFn: ({ next }) => {
      const params = next.params as { day?: string; part?: string };
      if (params.day === day && params.part !== undefined) return false;
      return !window.confirm("Leave this day without saving? Its changes will be lost.");
    },
  });
}
