import { AnchorIcon } from "lucide-react";
import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ANCHOR_ROW,
  type AnchorPlace,
  anchorPlaces,
  badgeLabel,
  definitiveAnchor,
  nameHolder,
  readAnchorFields,
} from "@/lib/grid-anchors";
import { GRID_ANCHOR, GRID_GROUP_NAME } from "@/lib/photo-fields";
import { currentData } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";

interface GroupStyle {
  ring: string;
  badge: string;
}

/** The outline and badge colors rows take by turns along the calendar: dark blue, then light blue. */
const GROUP_STYLES: [GroupStyle, GroupStyle] = [
  { ring: "ring-blue-800", badge: "bg-blue-800 text-white" },
  { ring: "ring-sky-300", badge: "bg-sky-300 text-sky-950" },
];

function groupStyle(group: number): GroupStyle {
  return GROUP_STYLES[group % 2] ?? GROUP_STYLES[0];
}

/**
 * The one Grid Anchor on the calendar and every photo's row worked out from it, with the changes
 * not committed yet counted; and changes to them, kept as local edits until **Commit**. byDay is
 * each calendar day's photo.
 */
export function useGridAnchors(photos: SocialPhoto[], byDay: Map<string, SocialPhoto>) {
  const changed = useChangedPhotoFiles();
  const setField = useLocalEditsStore((state) => state.setField);
  const { flagged, names } = useMemo(
    () =>
      readAnchorFields(
        photos.map((photo) => ({
          path: photo.path,
          data: (currentData(photo, changed) ?? {}) as Record<string, unknown>,
        })),
      ),
    [photos, changed],
  );
  const anchor = definitiveAnchor(byDay, flagged);
  const places = anchorPlaces(byDay, anchor, names);
  const byPath = (path: string) => photos.find((photo) => photo.path === path);
  const change = (path: string, value: unknown) => {
    const photo = byPath(path);
    return photo ? [{ path, before: photo.data, value }] : [];
  };
  /** Moves the Grid Anchor to path, shifting every row, or takes it away when path is null. */
  const moveAnchor = (path: string | null) => {
    const off = [...flagged].filter((p) => p !== path).flatMap((p) => change(p, null));
    setField(GRID_ANCHOR, [...off, ...(path ? change(path, true) : [])]);
  };
  /** Names path's row, on the photo that already holds its name; an empty name clears it. */
  const rename = (path: string, name: string) =>
    setField(GRID_GROUP_NAME, change(nameHolder(path, places, names), name.trim() ? name : null));
  return { anchor, places, moveAnchor, rename };
}

interface GridAnchorControlsProps {
  photo: SocialPhoto;
  anchors: ReturnType<typeof useGridAnchors>;
}

/**
 * The picker's Grid Anchor controls for the day's photo: a button that moves the Grid Anchor here
 * (or takes it away, on the anchor), and once there's an anchor, the optional name of the photo's row.
 */
export function GridAnchorControls({ photo, anchors }: GridAnchorControlsProps) {
  const place = anchors.places.get(photo.path);
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <AnchorToggle
        anchored={anchors.anchor === photo.path}
        onToggle={() => anchors.moveAnchor(anchors.anchor === photo.path ? null : photo.path)}
      />
      {place && (
        <Input
          className="h-8 w-48"
          placeholder="Group name (optional)"
          aria-label="Group name"
          value={place.name ?? ""}
          onChange={(event) => anchors.rename(photo.path, event.target.value)}
        />
      )}
    </div>
  );
}

/** The button that moves the Grid Anchor to the day's photo, or takes it away when it's there. */
function AnchorToggle({ anchored, onToggle }: { anchored: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={anchored ? "secondary" : "outline"}
      onClick={onToggle}
      title={`The Grid Anchor and the ${ANCHOR_ROW - 1} photos before it make one row of the feed; every other row is counted from it`}
    >
      <AnchorIcon />
      {anchored ? "Remove Grid Anchor" : "Make Grid Anchor"}
    </Button>
  );
}

/**
 * The outline of a photo's row, dark or light blue by turns, with an anchor badge on the photo
 * that ends the row. Shown over a calendar day or a feed tile.
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
      {place.isRowEnd && <AnchorBadge style={style} place={place} />}
    </>
  );
}

/**
 * The badge on the photo that ends a row, with the row's name when it has one: solid on the Grid
 * Anchor itself, faint on the anchors worked out from it.
 */
function AnchorBadge({ style, place }: { style: GroupStyle; place: AnchorPlace }) {
  const label = badgeLabel(place);
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1 right-1 z-20 flex max-w-[80%] items-center gap-0.5 rounded p-0.5 text-[10px] font-medium",
        place.isAnchor ? style.badge : "bg-background/85 text-foreground",
      )}
      title={label}
    >
      <AnchorIcon className="size-3 shrink-0" aria-hidden />
      {place.name && <span className="truncate">{place.name.trim()}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
