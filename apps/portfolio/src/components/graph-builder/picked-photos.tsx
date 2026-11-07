import { ArrowDownWideNarrow, ArrowUpNarrowWide, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PickedGroupSection, PickedThumbnails } from "@/components/graph-builder/picked-group";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import { type GraphConfig, statById } from "@/lib/graph-data";
import {
  type Direction,
  type GraphPick,
  orderedGroups,
  type PickedGroup,
  pickedPhotos,
  type PickOrder,
} from "@/lib/graph-pick";
import type { Photo } from "@/lib/photos";
import { CONTROL_FRAME, controlButtonClass, SELECT_CLASS } from "@/lib/segmented-control";
import { useShownPhoto } from "@/lib/shown-photo";

/** The picked value as its heading: the x value with its stat, and a dot's y value too. */
function pickTitle(config: GraphConfig, pick: GraphPick): string {
  const x = `${statById(config.x).label}: ${pick.x}`;
  return pick.y === undefined ? x : `${x} · ${statById(config.y).label}: ${pick.y}`;
}

/** A count of photos as words, such as "1 photo" or "12 photos". */
function photoCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "photo" : "photos"}`;
}

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
  const { shown, show, close } = useShownPhoto();
  return (
    <section
      aria-label="Picked photos"
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{pickTitle(config, pick)}</h2>
          <p className="text-sm text-muted-foreground tabular-nums">{photoCount(picked.total)}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden />
          Close
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {picked.groupedBy && (
          <OrderSelect order={order} groupedBy={picked.groupedBy} onChange={setOrder} />
        )}
        <DirectionButtons direction={direction} onChange={setDirection} />
      </div>
      <PickedBody
        groups={groups}
        grouped={picked.groupedBy !== null}
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
function PickedBody({
  groups,
  grouped,
  onOpen,
}: {
  groups: PickedGroup[];
  grouped: boolean;
  onOpen: (photo: Photo) => void;
}) {
  if (groups.length === 0 || groups[0]!.photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos are in this value.</p>;
  }
  if (!grouped) return <PickedThumbnails photos={groups[0]!.photos} onOpen={onOpen} />;
  return <PickedGroups groups={groups} onOpen={onOpen} />;
}

/** The groups, each opening and closing, all open at first, with buttons to open or close them all. */
function PickedGroups({
  groups,
  onOpen,
}: {
  groups: PickedGroup[];
  onOpen: (photo: Photo) => void;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => {
    const next = new Set(closed);
    if (!next.delete(key)) next.add(key);
    setClosed(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => setClosed(new Set())}>
          Expand all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setClosed(new Set(groups.map((group) => group.key)))}
        >
          Collapse all
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <PickedGroupSection
            key={group.key}
            group={group}
            open={!closed.has(group.key)}
            onToggle={() => toggle(group.key)}
            onOpen={onOpen}
          />
        ))}
      </ul>
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
