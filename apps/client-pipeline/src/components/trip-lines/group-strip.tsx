import { ChevronDown, ChevronRight, Eye, EyeOff, Merge } from "lucide-react";
import { useState } from "react";
import { PhotoStrip } from "@/components/trip-lines/photo-strip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TripPhoto } from "@/lib/trip-days";
import { type GapDraft, withGap } from "@/lib/trip-gaps";
import { type PhotoGroup, photoGroups, withGroupName, withGroupStart } from "@/lib/trip-groups";

interface GroupStripProps {
  photos: TripPhoto[];
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  onHover: (id: number | undefined) => void;
  /** The name of the group shown on its own on the map. */
  focus?: string;
  onFocus: (name: string | undefined) => void;
}

/**
 * The day's photos in groups, each its own named line: a group starts wherever the photos' place
 * changes, or at a photo split off by hand. Each group collapses to its header.
 */
export function GroupStrip({ photos, draft, onChange, onHover, focus, onFocus }: GroupStripProps) {
  const ids = photos.map((p) => p.id);
  const groups = photoGroups(ids, draft.groups);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((c) => new Set(c.has(key) ? [...c].filter((k) => k !== key) : [...c, key]));
  return (
    <ol
      className="flex items-start gap-2 overflow-x-auto pb-2"
      aria-label="The day's photos, by group"
    >
      {groups.map((g, n) => (
        <li key={g.key} className="flex shrink-0 items-start gap-2">
          {n > 0 && <GroupGap draft={draft} group={g} onChange={onChange} />}
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
          />
        </li>
      ))}
    </ol>
  );
}

interface GroupGapProps {
  draft: GapDraft;
  group: PhotoGroup;
  onChange: (draft: GapDraft) => void;
}

/** What happened between two groups, and joining the group to the one before. */
function GroupGap({ draft, group, onChange }: GroupGapProps) {
  return (
    <div className="flex flex-col items-center gap-1 pt-9">
      <PhotoStripGap draft={draft} index={group.start - 1} onChange={onChange} />
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
        />
      )}
    </div>
  );
}

/** The group's name field, photo count, and its collapse and show-alone buttons. */
function GroupHeader({
  group,
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
    </div>
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
