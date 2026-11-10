import { AnchorIcon } from "lucide-react";
import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ANCHOR_ROW, type AnchorPlace } from "@/lib/grid-anchors";
import { GRID_ANCHOR, GRID_GROUP_NAME } from "@/lib/photo-fields";
import { currentData } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";

interface GroupStyle {
  ring: string;
  badge: string;
}

/** The outline and badge colors groups take by turns along the calendar: dark blue, then light blue. */
const GROUP_STYLES: [GroupStyle, GroupStyle] = [
  { ring: "ring-blue-800", badge: "bg-blue-800 text-white" },
  { ring: "ring-sky-300", badge: "bg-sky-300 text-sky-950" },
];

function groupStyle(group: number): GroupStyle {
  return GROUP_STYLES[group % 2] ?? GROUP_STYLES[0];
}

function fieldOf(data: unknown, key: string): unknown {
  return typeof data === "object" && data !== null
    ? (data as Record<string, unknown>)[key]
    : undefined;
}

/** The anchor's group name, null when it has none, or undefined when the photo isn't an anchor. */
function anchorName(data: unknown): string | null | undefined {
  if (fieldOf(data, GRID_ANCHOR) !== true) return undefined;
  const name = fieldOf(data, GRID_GROUP_NAME);
  return typeof name === "string" && name.trim() ? name : null;
}

/**
 * The calendar photos marked as Grid Anchors, each with its group's name (or null), with the
 * changes not committed yet counted; and changes to them, kept as local edits until **Commit**.
 */
export function useGridAnchors(photos: SocialPhoto[]) {
  const changed = useChangedPhotoFiles();
  const setField = useLocalEditsStore((state) => state.setField);
  const anchors = useMemo(() => {
    const names = new Map<string, string | null>();
    for (const photo of photos) {
      const name = anchorName(currentData(photo, changed));
      if (name !== undefined) names.set(photo.path, name);
    }
    return names;
  }, [photos, changed]);
  const change = (photo: SocialPhoto, value: unknown) => [
    { path: photo.path, before: photo.data, value },
  ];
  /** Makes the photo an anchor, or stops it being one and drops its group's name. */
  const toggle = (photo: SocialPhoto) => {
    const on = !anchors.has(photo.path);
    setField(GRID_ANCHOR, change(photo, on ? true : null));
    if (!on) setField(GRID_GROUP_NAME, change(photo, null));
  };
  /** Names the anchor's group; an empty name leaves it without one. */
  const rename = (photo: SocialPhoto, name: string) =>
    setField(GRID_GROUP_NAME, change(photo, name.trim() ? name : null));
  return { anchors, toggle, rename };
}

interface GridAnchorControlsProps {
  /** The group's name ("" when it has none), or undefined when the photo isn't an anchor. */
  name: string | undefined;
  onToggle: () => void;
  onRename: (name: string) => void;
}

/**
 * The picker's controls for the day's photo as a Grid Anchor: a button that makes it one or stops
 * it being one, and while it is one, its group's optional name.
 */
export function GridAnchorControls({ name, onToggle, onRename }: GridAnchorControlsProps) {
  const anchored = name !== undefined;
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <AnchorToggle anchored={anchored} onToggle={onToggle} />
      {anchored && (
        <Input
          className="h-8 w-48"
          placeholder="Group name (optional)"
          aria-label="Grid Anchor group name"
          value={name}
          onChange={(event) => onRename(event.target.value)}
        />
      )}
    </div>
  );
}

/** The button that makes the day's photo a Grid Anchor, or stops it being one. */
function AnchorToggle({ anchored, onToggle }: { anchored: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={anchored ? "secondary" : "outline"}
      onClick={onToggle}
      title={`A Grid Anchor and the ${ANCHOR_ROW - 1} photos before it make one row of the feed`}
    >
      <AnchorIcon />
      {anchored ? "Remove Grid Anchor" : "Make Grid Anchor"}
    </Button>
  );
}

/**
 * The outline of a photo in a Grid Anchor group, in its group's color (dark or light blue by turns), with an anchor badge on
 * the anchor itself. Shown over a calendar day or a feed tile.
 */
export function AnchorOutline({ place }: { place: AnchorPlace | undefined }) {
  if (!place) return null;
  const style = groupStyle(place.group);
  return (
    <>
      <span
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-3 ring-inset",
          style.ring,
        )}
      />
      {place.isAnchor && <AnchorBadge style={style} name={place.name} />}
    </>
  );
}

/** The badge on a Grid Anchor's own photo, with its group's name when it has one. */
function AnchorBadge({ style, name }: { style: GroupStyle; name: string | null }) {
  const label = name ? `Grid Anchor: ${name}` : "Grid Anchor";
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1 right-1 z-20 flex max-w-[80%] items-center gap-0.5 rounded p-0.5 text-[10px] font-medium",
        style.badge,
      )}
      title={label}
    >
      <AnchorIcon className="size-3 shrink-0" aria-hidden />
      {name && <span className="truncate">{name.trim()}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
