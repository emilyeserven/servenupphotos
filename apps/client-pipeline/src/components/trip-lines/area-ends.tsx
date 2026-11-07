import { DoorOpen, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GapDraft } from "@/lib/trip-gaps";
import { type AreaPick, areaEndOf, wanderedAreas, withAreaEnd } from "@/lib/trip-wander";

interface AreaEndsProps {
  ids: number[];
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  /** The area end the map is waiting to have picked. */
  picking?: AreaPick;
  onPicking: (pick: AreaPick | undefined) => void;
}

/**
 * The areas wandered with no set route, each with where the line entered and left it for this day,
 * such as a park's gates: set on the map. The line from the photo before runs to the entrance, and
 * the line to the next photo from the exit, instead of to and from the photos inside.
 */
export function AreaEnds({ ids, draft, onChange, picking, onPicking }: AreaEndsProps) {
  const areas = wanderedAreas(ids, draft);
  if (areas.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Areas wandered</span>
      {areas.map(({ group, first, last }, n) => (
        <div key={group.key} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-40 truncate">{draft.names?.[group.key] || `Area ${n + 1}`}</span>
          {(["entrance", "exit"] as const).map((kind) => (
            <AreaEnd
              key={kind}
              pick={`${kind}:${kind === "entrance" ? first : last}`}
              draft={draft}
              onChange={onChange}
              picking={picking}
              onPicking={onPicking}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface AreaEndProps extends Omit<AreaEndsProps, "ids"> {
  pick: AreaPick;
}

/** What an area end is called, and its icon. */
function endInfo(pick: AreaPick) {
  return pick.startsWith("entrance")
    ? { what: "Entrance", Icon: DoorOpen }
    : { what: "Exit", Icon: LogOut };
}

/** One entrance or exit: a button to pick it on the map, or the one set with a button to clear it. */
function AreaEnd(props: AreaEndProps) {
  const { pick, draft } = props;
  return areaEndOf(draft, pick) ? <SetEnd {...props} /> : <PickEnd {...props} />;
}

/** An entrance or exit already set, with a button that clears it. */
function SetEnd({ pick, draft, onChange }: AreaEndProps) {
  const { what, Icon } = endInfo(pick);
  return (
    <span className="flex items-center gap-1 rounded-md border px-2 py-0.5">
      <Icon className="size-3.5" aria-hidden />
      {what} set
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={`Clear the ${what.toLowerCase()}`}
        onClick={() => onChange(withAreaEnd(draft, pick, undefined))}
      >
        <X className="size-3" />
      </Button>
    </span>
  );
}

/** A button that waits for the entrance or exit to be clicked on the map. */
function PickEnd({ pick, picking, onPicking }: AreaEndProps) {
  const { what, Icon } = endInfo(pick);
  const active = picking === pick;
  return (
    <Button
      variant={active ? "secondary" : "outline"}
      size="sm"
      onClick={() => onPicking(active ? undefined : pick)}
    >
      <Icon aria-hidden />
      {active ? "Click the map…" : `${what} on the map`}
    </Button>
  );
}
