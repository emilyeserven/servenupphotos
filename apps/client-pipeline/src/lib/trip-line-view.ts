import type { TripLine, TripPoint, TripVisit } from "@/api/trip-lines";
import type { EditorView, LineMode } from "@/components/trip-lines/editor-actions";
import { draftOf, type GapDraft, walkingDraft, withStops } from "@/lib/trip-gaps";
import { keptStops, lineStops, onlyStopsChanged } from "@/lib/trip-stops-kept";

/** What a view is switched from when the line switch picks another kind of line. */
export interface ModeFrom {
  view: EditorView;
  /** The day's photo IDs, in the view's order. */
  ids: number[];
  /** The day's trip line file, when it has one. */
  saved?: TripLine;
  /** The automatic line, once it's worked out. */
  auto?: TripLine;
  /** The line by hand last shown before switching away from it, so switching back keeps it. */
  lastHand?: GapDraft;
}

/** Whether the day's file is a line saved by hand, with a route drawn. */
function savedByHand(saved: TripLine | undefined): saved is TripLine {
  return saved !== undefined && !saved.auto && !saved.planned;
}

/** The segments to start a line by hand from: the one saved by hand, or else the automatic line. */
function handSegments({ saved, auto }: ModeFrom) {
  return savedByHand(saved) ? saved.segments : (auto?.segments ?? []);
}

/**
 * Where a line by hand starts when By hand is picked: the one shown last, the one saved, the
 * automatic line (as **Edit as my own** did), or else a walk through every photo.
 */
function handStart(from: ModeFrom): GapDraft {
  if (from.lastHand) return from.lastHand;
  const segments = handSegments(from);
  return segments.length > 0 ? draftOf(from.ids, segments) : walkingDraft(from.ids);
}

/**
 * The view for the kind of line picked, keeping the trip stops and areas as they are now: the
 * automatic line (a preview until it's saved), no line, or a line by hand.
 */
export function modeView(mode: LineMode, from: ModeFrom): EditorView {
  const stops = keptStops(from.view, from.saved);
  if (mode === "none") return { kind: "none", stops };
  if (mode === "auto") return { kind: from.saved?.auto ? "auto" : "preview", stops };
  const draft = { ...handStart(from), visits: stops.visits, fences: stops.fences };
  return { kind: "hand", draft: withStops(draft, from.ids.at(-1)) };
}

/**
 * The view after the strip or map changes the draft shown: beside the automatic line or no line, a
 * change to the trip stops alone keeps it that kind, with the stops to save; any other change
 * starts a line drawn by hand.
 */
export function editedView(view: EditorView, shown: GapDraft, draft: GapDraft): EditorView {
  if (view.kind !== "hand" && onlyStopsChanged(shown, draft)) {
    return { kind: view.kind, stops: lineStops(draft) };
  }
  return { kind: "hand", draft };
}

/** Whether the day's file has a line drawn, by hand or automatic, rather than only trip stops. */
function hasRoute(saved: TripLine | undefined): boolean {
  return saved !== undefined && (saved.auto || saved.segments.length > 0);
}

/** What the save button says it does for the view shown. */
export function saveLabel(view: EditorView, saved: TripLine | undefined): string {
  if (view.kind === "hand") return "Save route";
  if (view.kind === "preview") return "Turn on automatic line";
  if (view.kind === "auto") return "Update automatic line";
  return hasRoute(saved) ? "Remove route" : "Save trip stops";
}

/**
 * Whether there's anything to save: any change, or else the automatic line, which saving draws
 * again as the day's photos are now.
 */
export function canSave(view: EditorView, dirty: boolean): boolean {
  return dirty || view.kind === "auto" || view.kind === "preview";
}

/** What saving will do beyond what its button says, if anything. */
export function saveNote(view: EditorView, saved: TripLine | undefined, dirty: boolean): string {
  if (!dirty) return view.kind === "auto" ? "Update redraws it now, with photos added since." : "";
  return changeNote(view, saved);
}

/** What saving a change does that the button doesn't say. */
function changeNote(view: EditorView, saved: TripLine | undefined): string {
  if (view.kind === "hand") return saved?.auto ? TURNS_AUTO_OFF : "";
  if (view.kind === "auto") return view.stops ? STOPS_ON_AUTO : "";
  return view.kind === "none" && hasRoute(saved) ? "Saving removes the line; trip stops stay." : "";
}

/** Said when saving a line by hand replaces the automatic line. */
const TURNS_AUTO_OFF = "Saving turns the automatic line off and keeps this line by hand.";

/** Said when the automatic line's trip stops changed. */
const STOPS_ON_AUTO = "Trip stops changed: the line passes through the ones put on the route.";

/**
 * What the photo strip's Start or End says: the spot's label, a spot with no label, or the trip
 * stop the route starts at (the first) or ends at (the last); none when there's nothing there.
 */
export function endName(
  which: "start" | "end",
  spot: TripPoint | undefined,
  stops: TripVisit[],
): string | undefined {
  if (spot) return spot.label || "Spot on the map";
  const stop = which === "start" ? stops[0] : stops.at(-1);
  return stop && (stop.name || "Unnamed stop");
}
