import { ChevronDown, ChevronRight, Eye, EyeOff, Merge, Shuffle } from "lucide-react";
import { useState } from "react";
import type { TripVisit } from "@/api/trip-lines";
import { GroupAreaButton } from "@/components/trip-lines/group-area-button";
import { PhotoStrip } from "@/components/trip-lines/photo-strip";
import { VisitChips } from "@/components/trip-lines/visit-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TripPhoto } from "@/lib/trip-days";
import { type GapDraft, withGap } from "@/lib/trip-gaps";
import { type PhotoGroup, photoGroups, withGroupName, withGroupStart } from "@/lib/trip-groups";
import { insertedVisit, movedVisit, visitsAfter } from "@/lib/trip-visits";
import { VisitInsert } from "@/components/trip-lines/visit-insert";
import { isWandered, withWandered } from "@/lib/trip-wander";

interface GroupStripProps {
  photos: TripPhoto[];
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  onHover: (id: number | undefined) => void;
  /** The name of the group shown on its own on the map. */
  focus?: string;
  onFocus: (name: string | undefined) => void;
  /** Moves a photo one place earlier or later in the day. */
  onMove: (id: number, by: -1 | 1) => void;
  /** Lays the groups out top to bottom, with what happened between them in between, instead of in a row. */
  stacked?: boolean;
}

/**
 * The day's photos in groups, each its own named line: a group starts wherever the photos' place
 * changes, or at a photo split off by hand. Each group collapses to its header.
 */
export function GroupStrip(props: GroupStripProps) {
  const { photos, draft, onChange, onHover, focus, onFocus, onMove, stacked = false } = props;
  const ids = photos.map((p) => p.id);
  const groups = photoGroups(ids, draft.groups);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((c) => new Set(c.has(key) ? [...c].filter((k) => k !== key) : [...c, key]));
  const onMoveVisit = (visit: TripVisit, by: -1 | 1) => onChange(movedVisit(draft, visit, ids, by));
  return (
    <ol
      className={cn("flex items-start gap-2 pb-2", stacked ? "flex-col" : "overflow-x-auto")}
      aria-label="The day's photos, by group"
    >
      {groups.map((g, n) => (
        <li
          key={g.key}
          className={cn("flex items-start gap-2", stacked ? "w-full flex-col" : "shrink-0")}
        >
          {n > 0 && (
            <GroupGap
              draft={draft}
              group={g}
              photos={photos}
              onChange={onChange}
              onMoveVisit={onMoveVisit}
              before={visitsAfter(draft.visits, ids[g.start - 1])}
              stacked={stacked}
            />
          )}
          <GroupBox
            group={g}
            photos={photos}
            draft={draft}
            onChange={onChange}
            onHover={onHover}
            collapsed={collapsed.has(g.key)}
            onToggle={() => toggle(g.key)}
            focus={focus}
            onFocus={onFocus}
            onMove={onMove}
            onMoveVisit={onMoveVisit}
          />
        </li>
      ))}
    </ol>
  );
}

interface GroupGapProps {
  draft: GapDraft;
  group: PhotoGroup;
  photos: TripPhoto[];
  onChange: (draft: GapDraft) => void;
  onMoveVisit: (visit: TripVisit, by: -1 | 1) => void;
  /** The places visited on the route between the two groups. */
  before: TripVisit[];
  /** Whether the groups are stacked, so this sits between them under the first. */
  stacked: boolean;
}

/** What happened between two groups, the places visited there, and joining the two. */
function GroupGap(props: GroupGapProps) {
  const { draft, group, photos, onChange, onMoveVisit, before, stacked } = props;
  const [a, b] = [photos[group.start - 1], photos[group.start]];
  return (
    <div className={gapClass(stacked)}>
      {before.length > 0 && (
        <PhotoStripGap draft={draft} index={group.start - 1} onChange={onChange} />
      )}
      <VisitChips visits={before} onMove={onMoveVisit} />
      <PhotoStripGap draft={draft} index={group.start - 1} onChange={onChange} />
      {a && b && (
        <VisitInsert
          a={a}
          b={b}
          onInsert={(visit) => onChange(insertedVisit(draft, visit, a.id))}
        />
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        title="Join to the group before"
        onClick={() => onChange(withGroupStart(draft, Number(group.key), false))}
      >
        <Merge className="size-3.5" aria-hidden />
        <span className="sr-only">Join to the group before</span>
      </Button>
    </div>
  );
}

/** The gap's layout: under the first group, on a dashed line, when stacked; level with the photos in a row. */
function gapClass(stacked: boolean): string {
  return cn(
    "flex flex-col items-center gap-1",
    stacked ? "border-muted-foreground/30 ml-6 border-l-2 border-dashed py-1 pl-4" : "pt-9",
  );
}

/** The gap picker between the last photo of one group and the first of the next. */
function PhotoStripGap({
  draft,
  index,
  onChange,
}: {
  draft: GapDraft;
  index: number;
  onChange: (d: GapDraft) => void;
}) {
  return (
    <select
      aria-label={`Between photos ${index + 1} and ${index + 2}`}
      className="border-input bg-background h-8 rounded-md border px-1 text-xs"
      value={draft.gaps[index]}
      onChange={(e) => onChange(withGap(draft, index, e.target.value as GapDraft["gaps"][number]))}
    >
      {GAP_LABELS.map(([gap, label]) => (
        <option key={gap} value={gap}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** The gaps between groups, as their menu lists them. */
const GAP_LABELS: [GapDraft["gaps"][number], string][] = [
  ["walk", "Walk"],
  ["break", "Break"],
  ["train", "Train"],
  ["subway", "Subway"],
  ["bus", "Bus"],
  ["car", "Car"],
  ["transit", "Transit"],
];

interface GroupBoxProps {
  group: PhotoGroup;
  photos: TripPhoto[];
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  onHover: (id: number | undefined) => void;
  collapsed: boolean;
  onToggle: () => void;
  focus?: string;
  onFocus: (name: string | undefined) => void;
  onMove: (id: number, by: -1 | 1) => void;
  onMoveVisit: (visit: TripVisit, by: -1 | 1) => void;
}

/** One group: its name, how many photos, collapsing and showing it alone, and its photos. */
function GroupBox(props: GroupBoxProps) {
  const { group, photos, draft, onChange, onHover, collapsed } = props;
  return (
    <div className="flex flex-col gap-1 rounded-md border p-1.5">
      <GroupHeader {...props} />
      {!collapsed && (
        <PhotoStrip
          photos={photos.slice(group.start, group.end)}
          offset={group.start}
          gaps={draft.gaps}
          onGap={(i, gap) => onChange(withGap(draft, i, gap))}
          onHover={onHover}
          onSplit={(id) => onChange(withGroupStart(draft, id, true))}
          onMove={props.onMove}
          onMoveVisit={props.onMoveVisit}
          onInsertVisit={(after, visit) => onChange(insertedVisit(draft, visit, after))}
          visits={draft.visits}
        />
      )}
    </div>
  );
}

/**
 * The group's name field, photo count, its collapse and show-alone buttons, and the area of the
 * place its photos are at.
 */
function GroupHeader({
  group,
  photos,
  draft,
  onChange,
  collapsed,
  onToggle,
  focus,
  onFocus,
}: GroupBoxProps) {
  const name = draft.names?.[group.key] ?? "";
  return (
    <div className="flex items-center gap-1">
      <CollapseButton collapsed={collapsed} onToggle={onToggle} />
      <Input
        aria-label="Group name"
        placeholder="Name this group"
        className="h-7 w-40 text-sm"
        value={name}
        onChange={(e) => onChange(withGroupName(draft, group.key, e.target.value))}
      />
      <span className="text-muted-foreground px-1 text-xs whitespace-nowrap">
        {group.end - group.start} photos
      </span>
      <FocusButton name={name.trim()} focus={focus} onFocus={onFocus} />
      <WanderButton group={group} draft={draft} onChange={onChange} />
      <GroupAreaButton place={photos[group.start]?.place} />
    </div>
  );
}

interface WanderButtonProps {
  group: PhotoGroup;
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
}

/**
 * Marks the group as an area wandered with no set route, such as a hike: no line through its
 * photos, and the lines before and after it run to its entrance and from its exit once those are
 * set under the map. Pressed again, its photos are walked through again.
 */
function WanderButton({ group, draft, onChange }: WanderButtonProps) {
  const on = isWandered(draft, group);
  return (
    <Button
      variant={on ? "secondary" : "ghost"}
      size="icon"
      className="size-7"
      aria-pressed={on}
      disabled={group.end - group.start < 2}
      title={on ? "Walk through these photos again" : "Wandered this area with no set route"}
      onClick={() => onChange(withWandered(draft, group, !on))}
    >
      <Shuffle className="size-4" aria-hidden />
    </Button>
  );
}

/** Collapses the group to its header, or expands it. */
function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={onToggle}
      title={collapsed ? "Expand" : "Collapse"}
    >
      <Chevron className="size-4" aria-hidden />
    </Button>
  );
}

interface FocusButtonProps {
  name: string;
  focus?: string;
  onFocus: (name: string | undefined) => void;
}

/** Shows the named group alone on the map, the others faded, or every group again. */
function FocusButton({ name, focus, onFocus }: FocusButtonProps) {
  const alone = name !== "" && focus === name;
  const Icon = alone ? EyeOff : Eye;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      disabled={!name}
      title={alone ? "Show every group" : "Show this group alone on the map"}
      onClick={() => onFocus(alone ? undefined : name)}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
