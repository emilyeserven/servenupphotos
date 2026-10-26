import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon, GripVerticalIcon, ImageOffIcon } from "lucide-react";
import { type DragEvent, useState } from "react";
import { type Group, organizeQuery, setAlbumPhotoOrderMutation } from "@/api/organize";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { albumPhotoOrder, moved, photoId, savedPhotoOrder } from "@/lib/album-photo-order";
import type { CombinedPhoto } from "@/lib/group-photos";
import { cn } from "@/lib/utils";

interface AlbumPhotoReorderProps {
  album: Group;
  /** The photos shown on the album's page, in any order. */
  photos: CombinedPhoto[];
  /** Called once the order is saved, or when it's left unsaved. */
  onDone: () => void;
}

/**
 * The album's photos to put in order by dragging them, or with the arrows on each, saved as the
 * album's `photoOrder`, a change waiting for Commit. The portfolio shows the album's photos in this
 * order, on its pages and in the spotlight zones that show it.
 */
export function AlbumPhotoReorder({ album, photos, onDone }: AlbumPhotoReorderProps) {
  const [list, setList] = useState(() => albumPhotoOrder(photos, album.photoOrder));
  const drag = useDragOrder(setList);
  const save = usePhotoOrderSave(onDone);
  const move = (from: number, to: number) => setList((current) => moved(current, from, to));
  const saveOrder = (order: number[]) => save.mutate({ id: album.id, photoIds: order });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Drag the photos into the order the portfolio should show them, or move one with its arrows.
      </p>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
        {list.map((photo, i) => (
          <ReorderTile
            key={photoId(photo) ?? `index-${i}`}
            photo={photo}
            place={i}
            last={i === list.length - 1}
            dragging={drag.dragging === i}
            onMove={move}
            drag={drag}
          />
        ))}
      </ol>
      <ReorderButtons
        pending={save.isPending}
        custom={(album.photoOrder?.length ?? 0) > 0}
        onSave={() => saveOrder(savedPhotoOrder(list, album.photoOrder))}
        onReset={() => saveOrder([])}
        onCancel={onDone}
      />
      {save.isError && <p className="text-destructive">{save.error.message}</p>}
    </div>
  );
}

/** Saves the photo order, then reads the albums again and leaves reordering. */
function usePhotoOrderSave(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    ...setAlbumPhotoOrderMutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
      onDone();
    },
  });
}

/**
 * The tile being dragged, by its place, and the handlers that move it to the place of each tile it
 * passes over, so the grid shows the new order as it's dragged.
 */
function useDragOrder(setList: (update: (list: CombinedPhoto[]) => CombinedPhoto[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  return {
    dragging,
    start: (place: number, event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      // Firefox only starts a drag that carries data.
      event.dataTransfer.setData("text/plain", String(place));
      setDragging(place);
    },
    enter: (place: number) => {
      if (dragging === null || dragging === place) return;
      setList((list) => moved(list, dragging, place));
      setDragging(place);
    },
    end: () => setDragging(null),
  };
}

type DragOrder = ReturnType<typeof useDragOrder>;

interface ReorderTileProps {
  photo: CombinedPhoto;
  /** Its place in the list, 0 first. */
  place: number;
  last: boolean;
  dragging: boolean;
  onMove: (from: number, to: number) => void;
  drag: DragOrder;
}

/** A photo's Square Thumbnail with its place, to drag, and arrows that move it one place. */
function ReorderTile({ photo, place, last, dragging, onMove, drag }: ReorderTileProps) {
  const name = photoName(photo);
  return (
    <li
      draggable
      onDragStart={(event) => drag.start(place, event)}
      onDragEnter={() => drag.enter(place)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
      onDragEnd={drag.end}
      className={cn(
        "bg-card flex cursor-grab flex-col gap-1.5 rounded-lg border p-1.5 active:cursor-grabbing",
        dragging && "border-primary opacity-50",
      )}
    >
      <ReorderThumbnail photo={photo} name={name} place={place} />
      <div className="flex items-center gap-1">
        <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs" title={name}>
          {name}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Move ${name} earlier`}
          disabled={place === 0}
          onClick={() => onMove(place, place - 1)}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Move ${name} later`}
          disabled={last}
          onClick={() => onMove(place, place + 1)}
        >
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </li>
  );
}

/** The photo's Square Thumbnail, or a placeholder, with its place, 1 first, in the corner. */
function ReorderThumbnail({
  photo,
  name,
  place,
}: {
  photo: CombinedPhoto;
  name: string;
  place: number;
}) {
  const square = squareUrl(photo);
  return (
    <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
      {square ? (
        <img
          src={square}
          alt={name}
          loading="lazy"
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center">
          <ImageOffIcon className="size-5" aria-hidden />
        </div>
      )}
      <span className="bg-background/85 absolute top-1 left-1 rounded px-1.5 text-xs font-medium tabular-nums">
        {place + 1}
      </span>
    </div>
  );
}

interface ReorderButtonsProps {
  pending: boolean;
  /** Whether the album has a photo order to go back from. */
  custom: boolean;
  onSave: () => void;
  onReset: () => void;
  onCancel: () => void;
}

function ReorderButtons({ pending, custom, onSave, onReset, onCancel }: ReorderButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={onSave}>
        {pending && <Spinner />}
        Save order
      </Button>
      <Button variant="outline" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
      {custom && (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={onReset}
          title="Newest first, after any photos with an old homepage place"
        >
          Use the default order
        </Button>
      )}
    </div>
  );
}
