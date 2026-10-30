import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Rows3Icon, Trash2Icon } from "lucide-react";
import type { AlbumRow } from "@/api/organize";
import { LayoutPhotoList } from "@/components/album-layout/layout-photo";
import { MarkdownField } from "@/components/album-layout/markdown-field";
import { PhotoPickDialog } from "@/components/album-layout/photo-pick-dialog";
import { Button } from "@/components/ui/button";
import { moved, photoId } from "@/lib/album-photo-order";
import { EMPTY_ROW, MAX_ROW_PHOTOS, emptyRow, placedIds, withRow } from "@/lib/album-layout";
import type { CombinedPhoto } from "@/lib/group-photos";

interface LayoutRowsProps {
  layout: AlbumRow[];
  /** The album's photos, in its order. */
  photos: CombinedPhoto[];
  byId: ReadonlyMap<number, CombinedPhoto>;
  onChange: (layout: AlbumRow[]) => void;
}

/**
 * The album's rows to edit: each with Markdown text above, up to 4 photos side by side, and text
 * below, with buttons to add, move and remove rows, and to put the photos not in a row into rows of
 * their own.
 */
export function LayoutRows({ layout, photos, byId, onChange }: LayoutRowsProps) {
  const placed = placedIds(layout);
  const unplaced = photos.filter((photo) => !placed.has(photoId(photo) ?? 0));
  const update = (place: number, change: (row: AlbumRow) => AlbumRow) =>
    onChange(withRow(layout, place, change));
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Rows</h3>
        <p className="text-muted-foreground text-xs">
          The album's page shows each row's photos side by side, as tall as each other, with its
          text above and below. <UnplacedNote count={unplaced.length} rows={layout.length} />
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {layout.map((row, i) => (
          <RowEditor
            key={i}
            row={row}
            place={i}
            last={i === layout.length - 1}
            unplaced={unplaced}
            byId={byId}
            onChange={(change) => update(i, change)}
            onMove={(to) => onChange(moved(layout, i, to))}
            onRemove={() => onChange(layout.filter((_, other) => other !== i))}
          />
        ))}
      </ol>
      <RowButtons layout={layout} unplaced={unplaced} onChange={onChange} />
    </section>
  );
}

/** How the portfolio shows the photos no row has. */
function UnplacedNote({ count, rows }: { count: number; rows: number }) {
  if (rows === 0) return "With no rows, it shows one photo after another, in the album's order.";
  if (count === 0) return "Every photo is in a row.";
  const photos = count === 1 ? "1 photo isn't" : `${count} photos aren't`;
  return `${photos} in a row; the page shows them after the rows, one after another.`;
}

function RowButtons({
  layout,
  unplaced,
  onChange,
}: Pick<LayoutRowsProps, "layout" | "onChange"> & { unplaced: CombinedPhoto[] }) {
  const ids = unplaced.flatMap((photo) => photoId(photo) ?? []);
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => onChange([...layout, EMPTY_ROW])}>
        <PlusIcon aria-hidden />
        Add a row
      </Button>
      {ids.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([...layout, ...ids.map((id) => ({ ...EMPTY_ROW, photos: [id] }))])
          }
        >
          <Rows3Icon aria-hidden />
          Give each photo not in a row its own ({ids.length})
        </Button>
      )}
    </div>
  );
}

interface RowEditorProps {
  row: AlbumRow;
  place: number;
  last: boolean;
  unplaced: CombinedPhoto[];
  byId: ReadonlyMap<number, CombinedPhoto>;
  onChange: (change: (row: AlbumRow) => AlbumRow) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function RowEditor({
  row,
  place,
  last,
  unplaced,
  byId,
  onChange,
  onMove,
  onRemove,
}: RowEditorProps) {
  return (
    <li className="bg-muted/20 flex flex-col gap-3 rounded-lg border p-3">
      <RowHeader
        place={place}
        last={last}
        empty={emptyRow(row)}
        onMove={onMove}
        onRemove={onRemove}
      />
      <MarkdownField
        label="Text above"
        value={row.textAbove}
        onChange={(textAbove) => onChange((r) => ({ ...r, textAbove }))}
      />
      <ul className="flex flex-wrap items-center gap-2">
        <LayoutPhotoList
          ids={row.photos}
          photos={byId}
          onChange={(photos) => onChange((r) => ({ ...r, photos }))}
        />
        <li>
          <PhotoPickDialog
            label={row.photos.length === 0 ? "Add photos" : "Add more"}
            title={`Photos for row ${place + 1}`}
            description={`Pick up to ${MAX_ROW_PHOTOS - row.photos.length} of the photos not in a row yet, left to right in the order you click them.`}
            choices={unplaced}
            max={MAX_ROW_PHOTOS - row.photos.length}
            onPick={(ids) => onChange((r) => ({ ...r, photos: [...r.photos, ...ids] }))}
          />
        </li>
      </ul>
      <MarkdownField
        label="Text below"
        value={row.textBelow}
        onChange={(textBelow) => onChange((r) => ({ ...r, textBelow }))}
      />
    </li>
  );
}

interface RowHeaderProps {
  place: number;
  last: boolean;
  /** Whether it has no photos or text yet, which can't be saved. */
  empty: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function RowHeader({ place, last, empty, onMove, onRemove }: RowHeaderProps) {
  const n = place + 1;
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium">Row {n}</span>
      {empty && <span className="text-destructive text-xs">needs photos or text</span>}
      <Button
        size="icon-sm"
        variant="ghost"
        className="ml-auto"
        aria-label={`Move row ${n} up`}
        disabled={place === 0}
        onClick={() => onMove(place - 1)}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Move row ${n} down`}
        disabled={last}
        onClick={() => onMove(place + 1)}
      >
        <ArrowDownIcon aria-hidden />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={`Remove row ${n}`} onClick={onRemove}>
        <Trash2Icon aria-hidden />
      </Button>
    </div>
  );
}
