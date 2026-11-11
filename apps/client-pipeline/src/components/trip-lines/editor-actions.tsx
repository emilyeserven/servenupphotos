import type { TripLine } from "@/api/trip-lines";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import type { GapDraft } from "@/lib/trip-gaps";
import { canSave, saveLabel, saveNote } from "@/lib/trip-line-view";
import type { KeptStops } from "@/lib/trip-stops-kept";
import { cn } from "@/lib/utils";

/**
 * What the day editor shows: no line, a preview of the automatic line, the automatic line turned
 * on, or a line marked by hand. `stops` are the trip stops and areas as changed and not saved yet,
 * which every kind of line but one by hand keeps beside it.
 */
export type EditorView =
  | { kind: "none"; stops?: KeptStops }
  | { kind: "preview"; stops?: KeptStops }
  | { kind: "auto"; stops?: KeptStops }
  | { kind: "hand"; draft: GapDraft };

/** The kinds of line the line switch picks between: none, the automatic line, or one by hand. */
export type LineMode = "none" | "auto" | "hand";

/** The kind of line a view shows, as the line switch names it: a preview is the automatic line. */
function modeOf(view: EditorView): LineMode {
  return view.kind === "preview" ? "auto" : view.kind;
}

/** The line switch's choices, in order. */
const MODES: { mode: LineMode; label: string }[] = [
  { mode: "none", label: "No line" },
  { mode: "auto", label: "Automatic" },
  { mode: "hand", label: "By hand" },
];

/** What each view says under the line switch. */
const NOTES: Record<EditorView["kind"], string> = {
  none: "No line yet, so the map draws none for this day. Automatic draws one from the photos; By hand starts from a walk through every photo.",
  preview:
    "A preview of the automatic line: breaks where photos are over 2 hours apart, and a hop where moving was faster than walking. Save to turn it on.",
  auto: "The automatic line is on: it's worked out again at every Commit, so photos added to this day later join it.",
  hand: "Pick what happened between each two photos, where the day starts and ends, and shape the line on the map.",
};

interface LineSwitchProps {
  view: EditorView;
  onMode: (mode: LineMode) => void;
  /** Whether the automatic line is being worked out. */
  autoBusy: boolean;
}

/**
 * The kind of line the day has, picked above the photo strip: none, automatic or by hand, with what
 * the one picked means. Picking one changes nothing saved until the save bar saves it.
 */
export function LineSwitch({ view, onMode, autoBusy }: LineSwitchProps) {
  const current = modeOf(view);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="group"
        aria-label="The day's line"
        className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-lg p-1"
      >
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={mode === current}
            onClick={() => mode !== current && onMode(mode)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium",
              mode === current && "bg-background text-foreground shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {autoBusy ? "Working out the automatic line…" : NOTES[view.kind]}
      </p>
    </div>
  );
}

interface Mutation {
  isPending: boolean;
  error: Error | null;
}

interface SaveBarProps {
  view: EditorView;
  /** Whether anything on the day's pages has changed since it was opened or last saved. */
  dirty: boolean;
  /** The day's trip line file, when it has one. */
  saved?: TripLine;
  autoError: Error | null;
  autoBusy: boolean;
  save: Mutation;
  remove: Mutation;
  onSave: () => void;
}

/**
 * The bar kept at the bottom of the screen under the day's editor: whether it has unsaved
 * changes, what saving will do, and the one button that saves it as a change waiting for Commit.
 */
export function SaveBar(props: SaveBarProps) {
  const { view, dirty, saved, save, remove, onSave } = props;
  const busy = save.isPending || remove.isPending || props.autoBusy;
  return (
    <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 shadow-sm backdrop-blur">
      <Button disabled={busy || !canSave(view, dirty)} onClick={onSave}>
        <Busy busy={busy} />
        {saveLabel(view, saved)}
      </Button>
      <DirtyMark dirty={dirty} />
      <SaveNote error={firstError(props)} why={saveNote(view, saved, dirty)} />
    </div>
  );
}

/** Whether the day has changes not saved yet, as a dot and words. */
function DirtyMark({ dirty }: { dirty: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", dirty ? "bg-amber-500" : "bg-muted-foreground/40")}
      />
      {dirty ? "Unsaved changes" : "No unsaved changes"}
    </span>
  );
}

/** Why the last save, removal or look at the automatic line failed, if one did. */
function firstError({ save, remove, autoError }: SaveBarProps): Error | null {
  return save.error ?? remove.error ?? autoError;
}
