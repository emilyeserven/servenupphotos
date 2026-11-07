import { Busy, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { type GapDraft, walkingDraft } from "@/lib/trip-gaps";

/**
 * What the day editor shows: nothing marked yet, a preview of the automatic line, the automatic
 * line turned on, or a line marked by hand.
 */
export type EditorView =
  | { kind: "none" }
  | { kind: "preview" }
  | { kind: "auto" }
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
  auto: "The automatic line is on: it's worked out again at every Commit, so photos added to this day later join it.",
  hand: "",
};

/** A note on what the view shows. */
function note({ view, autoBusy }: EditorActionsProps): string {
  return autoBusy ? "Working out the automatic line…" : NOTES[view.kind];
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

function AutoButtons({ remove, onRemove, onEditOwn, autoBusy }: EditorActionsProps) {
  return (
    <>
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
