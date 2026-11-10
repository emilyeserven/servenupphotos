import { AnchorIcon } from "lucide-react";
import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import {
  ANCHOR_ROW,
  type AnchorPlace,
  type FeedAlignment,
  alignmentText,
} from "@/lib/grid-anchors";
import { GRID_ANCHOR } from "@/lib/photo-fields";
import { currentData } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";

interface GroupStyle {
  ring: string;
  badge: string;
}

/** Each group's outline and badge colors, by its index; groups past the last start again. */
const GROUP_STYLES: [GroupStyle, ...GroupStyle[]] = [
  { ring: "ring-amber-500", badge: "bg-amber-500 text-white" },
  { ring: "ring-sky-500", badge: "bg-sky-500 text-white" },
  { ring: "ring-fuchsia-500", badge: "bg-fuchsia-500 text-white" },
  { ring: "ring-lime-600", badge: "bg-lime-600 text-white" },
];

function groupStyle(group: number): GroupStyle {
  return GROUP_STYLES[group % GROUP_STYLES.length] ?? GROUP_STYLES[0];
}

function isAnchored(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>)[GRID_ANCHOR] === true
  );
}

/**
 * The calendar photos marked as Grid Anchors, with the changes not committed yet counted, and a
 * toggle that keeps the change as a local edit until **Commit**.
 */
export function useGridAnchors(photos: SocialPhoto[]) {
  const changed = useChangedPhotoFiles();
  const setField = useLocalEditsStore((state) => state.setField);
  const anchored = useMemo(
    () =>
      new Set(photos.filter((photo) => isAnchored(currentData(photo, changed))).map((p) => p.path)),
    [photos, changed],
  );
  const toggle = (photo: SocialPhoto) =>
    setField(GRID_ANCHOR, [
      { path: photo.path, before: photo.data, value: anchored.has(photo.path) ? null : true },
    ]);
  return { anchored, toggle };
}

interface GridAnchorToggleProps {
  anchored: boolean;
  onToggle: () => void;
}

/** The picker's button that makes the day's photo a Grid Anchor, or stops it being one. */
export function GridAnchorToggle({ anchored, onToggle }: GridAnchorToggleProps) {
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
 * The outline of a photo in a Grid Anchor group, in its group's color, with an anchor badge on
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
      {place.isAnchor && <AnchorBadge style={style} />}
    </>
  );
}

/** The badge on a Grid Anchor's own photo. */
function AnchorBadge({ style }: { style: GroupStyle }) {
  return (
    <span
      className={cn("pointer-events-none absolute top-1 right-1 z-20 rounded p-0.5", style.badge)}
      title="Grid Anchor"
    >
      <AnchorIcon className="size-3" aria-hidden />
      <span className="sr-only">Grid Anchor</span>
    </span>
  );
}

interface AnchorAlignmentsProps {
  alignments: FeedAlignment[];
  /** Each photo's name, by file path. */
  names: Map<string, string>;
}

/** Whether each Grid Anchor group in the feed fills a row, above the Social Feed preview's grid. */
export function AnchorAlignments({ alignments, names }: AnchorAlignmentsProps) {
  if (alignments.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {alignments.map((alignment) => {
        const { group } = alignment;
        return (
          <li key={group.anchor} className="flex items-center gap-2">
            <span className={cn("rounded p-0.5", groupStyle(group.index).badge)}>
              <AnchorIcon className="size-3" aria-hidden />
            </span>
            <span className={alignment.aligned ? "" : "text-destructive"}>
              <strong>{names.get(group.anchor) ?? group.anchor}</strong>&apos;s group{" "}
              {alignmentText(alignment)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
