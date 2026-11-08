import { Busy, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { type GapDraft, walkingDraft } from "@/lib/trip-gaps";
import type { KeptStops } from "@/lib/trip-stops-kept";

/**
 * What the day editor shows: nothing marked yet, a preview of the automatic line, the automatic
 * line turned on, or a line marked by hand.
 */
export type EditorView =
  | { kind: "none" }
  | { kind: "preview" }
  /** The automatic line, with stops: its trip stops and areas as changed and not saved yet. */
  | { kind: "auto"; stops?: KeptStops }
  | { kind: "hand"; draft: GapDraft };

interface Mutation {
  isPending: boolean;
  error: Error | null;
}

interface EditorActionsProps {
  view: EditorView;
  /** Whether the day has a trip line file. */
  saved: boolean;
  autoError: Error | null;
  autoBusy: boolean;
  save: Mutation;
  remove: Mutation;
  onSaveHand: () => void;
  onTurnOnAuto: () => void;
  /** Saves the automatic line again, as the day's photos and trip stops draw it now. */
  onUpdateAuto: () => void;
  onRemove: () => void;
  onEditOwn: () => void;
  setView: (view: EditorView) => void;
  ids: number[];
}

/** The editor's buttons for its view. */
export function EditorActions(props: EditorActionsProps) {
  const { save, remove, autoError } = props;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ViewButtons {...props} />
      </div>
      <SaveNote error={save.error ?? remove.error ?? autoError} why={note(props)} />
    </div>
  );
}

/** What each view says under its buttons. */
const NOTES: Record<EditorView["kind"], string> = {
  none: "No trip line yet, so the map draws none for this day.",
  preview:
    "A preview, not saved. Breaks are where photos are over 2 hours apart; a hop where moving was faster than walking.",
  auto: "The automatic line is on: it's worked out again at every Commit, so photos added to this day later join it. Update automatic line redraws it now, through the trip stops put on the route.",
  hand: "",
};

/** What the automatic line says while its trip stops have changes not saved yet. */
const STOPS_CHANGED =
  "Trip stops changed: Update automatic line saves them, with the line passing through the ones put on the route.";

/** A note on what the view shows. */
function note({ view, autoBusy }: EditorActionsProps): string {
  if (autoBusy) return "Working out the automatic line…";
  return view.kind === "auto" && view.stops ? STOPS_CHANGED : NOTES[view.kind];
}

function ViewButtons(props: EditorActionsProps) {
  const Buttons = BUTTONS[props.view.kind];
  return <Buttons {...props} />;
}

function NoneButtons({ setView, ids }: EditorActionsProps) {
  return (
    <>
      <Button onClick={() => setView({ kind: "preview" })}>Preview automatic line</Button>
      <Button variant="outline" onClick={() => setView({ kind: "hand", draft: walkingDraft(ids) })}>
        Mark by hand
      </Button>
    </>
  );
}

function PreviewButtons({ save, onTurnOnAuto, onEditOwn, setView, autoBusy }: EditorActionsProps) {
  return (
    <>
      <Button disabled={save.isPending || autoBusy} onClick={onTurnOnAuto}>
        <Busy busy={save.isPending} />
        Turn on automatic line
      </Button>
      <Button variant="outline" disabled={autoBusy} onClick={onEditOwn}>
        Edit as my own
      </Button>
      <Button variant="ghost" onClick={() => setView({ kind: "none" })}>
        Cancel
      </Button>
    </>
  );
}

function AutoButtons(props: EditorActionsProps) {
  const { save, remove, onRemove, onEditOwn, onUpdateAuto, autoBusy } = props;
  return (
    <>
      <Button disabled={save.isPending || autoBusy} onClick={onUpdateAuto}>
        <Busy busy={save.isPending} />
        Update automatic line
      </Button>
      <Button variant="outline" disabled={autoBusy} onClick={onEditOwn}>
        Edit as my own
      </Button>
      <Button variant="outline" disabled={remove.isPending} onClick={onRemove}>
        <Busy busy={remove.isPending} />
        Turn off automatic line
      </Button>
    </>
  );
}

function HandButtons({ save, remove, saved, onSaveHand, onRemove }: EditorActionsProps) {
  return (
    <>
      <Button disabled={save.isPending} onClick={onSaveHand}>
        <Busy busy={save.isPending} />
        Save route
      </Button>
      {saved && (
        <Button variant="outline" disabled={remove.isPending} onClick={onRemove}>
          <Busy busy={remove.isPending} />
          Remove route
        </Button>
      )}
    </>
  );
}

/** Each view's buttons. */
const BUTTONS: Record<EditorView["kind"], (props: EditorActionsProps) => React.ReactNode> = {
  none: NoneButtons,
  preview: PreviewButtons,
  auto: AutoButtons,
  hand: HandButtons,
};
