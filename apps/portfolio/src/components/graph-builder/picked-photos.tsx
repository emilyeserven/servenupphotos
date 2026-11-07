import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronsDownUp,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PickAxes } from "@/components/graph-builder/pick-axes";
import {
  GridCount,
  PickedGroupSection,
  PickedThumbnails,
} from "@/components/graph-builder/picked-group";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import {
  type Direction,
  type GraphPick,
  orderedGroups,
  type PickedGroup,
  pickedPhotos,
  type PickOrder,
} from "@/lib/graph-pick";
import { gridSearch } from "@/lib/graph-pick-grid";
import type { Photo } from "@/lib/photos";
import { CONTROL_FRAME, controlButtonClass, SELECT_CLASS } from "@/lib/segmented-control";
import { useShownPhoto } from "@/lib/shown-photo";

/**
 * The photos of the value picked on the graph, under it: in groups that open and close when the
 * graph splits its values (or for a pie's Other slice), ordered ascending or descending by the
 * groups' values on the axis or how many photos they have. Each photo opens in the lightbox.
 */
export function PickedPhotos({
  list,
  config,
  pick,
  onClear,
}: {
  /** The photos the filters keep. */
  list: Photo[];
  config: GraphConfig;
  pick: GraphPick;
  onClear: () => void;
}) {
  const picked = useMemo(() => pickedPhotos(list, config, pick), [list, config, pick]);
  const [order, setOrder] = useState<PickOrder>("axis");
  const [direction, setDirection] = useState<Direction>("asc");
  const groups = orderedGroups(picked.groups, order, direction);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const { shown, show, close } = useShownPhoto();
  const searchOf = (group: PickedGroup) => gridSearch(config, pick, group);
  return (
    <section
      aria-label="Selected photos"
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="font-semibold">Selected Photos</h2>
          <PickAxes config={config} pick={pick} picked={picked} total={list.length} />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden />
          Close
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {picked.groupedBy && (
            <OrderSelect order={order} groupedBy={picked.groupedBy} onChange={setOrder} />
          )}
          <DirectionButtons direction={direction} onChange={setDirection} />
        </div>
        {picked.groupedBy ? (
          <ExpandButtons groups={groups} closed={closed} onChange={setClosed} />
        ) : (
          groups[0] && (
            <GridCount
              search={searchOf(groups[0])}
              count={groups[0].photos.length}
              label={groups[0].label}
            />
          )
        )}
      </div>
      <PickedBody
        groups={groups}
        grouped={picked.groupedBy !== null}
        closed={closed}
        onClosedChange={setClosed}
        searchOf={searchOf}
        onOpen={(photo) => photo.image && show(photo)}
      />
      <PhotoLightbox
        photo={shown}
        photos={groups.flatMap((group) => group.photos)}
        onShow={show}
        onClose={close}
      />
    </section>
  );
}

/** The picked photos: in groups that open and close, or as one set of thumbnails. */
function PickedBody({ groups, grouped, onOpen, ...open }: GroupsProps & { grouped: boolean }) {
  if (groups.length === 0 || groups[0]!.photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos are in this value.</p>;
  }
  if (!grouped) return <PickedThumbnails photos={groups[0]!.photos} onOpen={onOpen} />;
  return <PickedGroups groups={groups} onOpen={onOpen} {...open} />;
}

/** The groups, which of them are closed, and opening a photo. */
interface GroupsProps {
  groups: PickedGroup[];
  closed: ReadonlySet<string>;
  onClosedChange: (closed: ReadonlySet<string>) => void;
  /** The Grid's filters for a group's photos. */
  searchOf: (group: PickedGroup) => Record<string, unknown>;
  onOpen: (photo: Photo) => void;
}

/** The groups, each opening and closing from its heading; all open at first. */
function PickedGroups({ groups, closed, onClosedChange, searchOf, onOpen }: GroupsProps) {
  const toggle = (key: string) => {
    const next = new Set(closed);
    if (!next.delete(key)) next.add(key);
    onClosedChange(next);
  };
  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <PickedGroupSection
          key={group.key}
          group={group}
          search={searchOf(group)}
          open={!closed.has(group.key)}
          onToggle={() => toggle(group.key)}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

/**
 * Expand all and Collapse all, joined like the Graph / Table buttons, the one matching the groups
 * pressed: Expand all while every group is open, Collapse all while every one is closed.
 */
function ExpandButtons({
  groups,
  closed,
  onChange,
}: {
  groups: PickedGroup[];
  closed: ReadonlySet<string>;
  onChange: (closed: ReadonlySet<string>) => void;
}) {
  const allClosed = groups.every((group) => closed.has(group.key));
  const button = (label: string, on: boolean, Icon: typeof X, next: () => Set<string>) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(next())}
      className={controlButtonClass(on)}
    >
      <Icon aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Groups" className={CONTROL_FRAME}>
      {button("Expand all", closed.size === 0, ChevronsUpDown, () => new Set())}
      {button("Collapse all", allClosed, ChevronsDownUp, () => new Set(groups.map((g) => g.key)))}
    </div>
  );
}

/** What the groups are ordered by: their values on the axis, such as each season, or how many photos they have. */
function OrderSelect({
  order,
  groupedBy,
  onChange,
}: {
  order: PickOrder;
  groupedBy: string;
  onChange: (order: PickOrder) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Order by
      <select
        value={order}
        onChange={(e) => onChange(e.target.value as PickOrder)}
        className={SELECT_CLASS}
      >
        <option value="axis">{groupedBy}</option>
        <option value="photos">Photos</option>
      </select>
    </label>
  );
}

/** The Ascending and Descending buttons. */
function DirectionButtons({
  direction,
  onChange,
}: {
  direction: Direction;
  onChange: (direction: Direction) => void;
}) {
  const button = (option: Direction, label: string, Icon: typeof X) => (
    <button
      type="button"
      aria-pressed={direction === option}
      onClick={() => onChange(option)}
      className={controlButtonClass(direction === option)}
    >
      <Icon aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Direction" className={CONTROL_FRAME}>
      {button("asc", "Ascending", ArrowUpNarrowWide)}
      {button("desc", "Descending", ArrowDownWideNarrow)}
    </div>
  );
}
