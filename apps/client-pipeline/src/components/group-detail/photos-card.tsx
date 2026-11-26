import { ArrowDownUpIcon, MinusIcon } from "lucide-react";
import { useState } from "react";
import { type Group, type GroupKind, albumDescendants } from "@/api/organize";
import {
  type AlbumAdd,
  AlbumAddOutcome,
  AlbumAddPhotos,
  useAlbumAdd,
} from "@/components/album-add-photos";
import { AlbumPhotoReorder } from "@/components/album-photo-reorder";
import { AlbumPhotoGrid } from "@/components/album-remove-one";
import {
  type AlbumRemove,
  AlbumRemoveOutcome,
  AlbumRemovePhotos,
  useAlbumRemove,
} from "@/components/album-remove-photos";
import { type GroupPhotos, useGroupPhotos } from "@/components/group-photo-grid";
import { PhotoShapeFilter } from "@/components/photo-shape-filter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PhotoShape } from "@/lib/aspect-ratio";
import { photosOfShape } from "@/lib/photo-shapes";
import { EmptyNote, NO_PHOTOS_MATCH } from "@portfolio/components/empty-note";
import { isSmartAlbum } from "@portfolio/lib/smart-albums";

/** Whether the group is an album whose file could be read. */
export function isReadableAlbum(kind: GroupKind, group: Group): boolean {
  return kind === "albums" && !group.error;
}

/**
 * The photos ALLPHOTOS.json lists in the album or tag, in the album's order; for an album,
 * optionally with the ones in its sub-albums too, and a way to put them in order.
 */
export function GroupPhotosCard({
  kind,
  group,
  albums,
}: {
  kind: GroupKind;
  group: Group;
  albums: Group[];
}) {
  const subAlbums = subAlbumIds(kind, group, albums);
  const [withSubAlbums, setWithSubAlbums] = useState(false);
  const [mode, setMode] = useState<PhotosMode>("view");
  const [shape, setShape] = useState<PhotoShape>();
  const ids = new Set([group.id, ...(withSubAlbums ? subAlbums : [])]);
  const { combined, current, photos } = useGroupPhotos(kind, ids);
  const adding = useAlbumAdd();
  const removing = useAlbumRemove();

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Photos{photos && ` (${photos.length})`}</CardTitle>
        <CardDescription>
          <PhotosSource current={current} />
        </CardDescription>
        {mode === "view" && (
          <CardAction className="flex flex-col items-end gap-2">
            <AddPhotosButton kind={kind} group={group} add={adding.add} />
            <ReorderButton
              show={canReorder(kind, group, photos)}
              onClick={() => setMode("reorder")}
            />
            <RemoveButton
              show={canRemove(kind, group, photos)}
              onClick={() => {
                removing.reset();
                setMode("remove");
              }}
            />
            <SubAlbumsToggle
              show={subAlbums.size > 0}
              checked={withSubAlbums}
              onChange={setWithSubAlbums}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <AlbumAddOutcome {...adding} />
        <AlbumRemoveOutcome remove={removing} />
        <PhotosOrReorder
          group={group}
          combined={combined}
          photos={photos}
          shape={shape}
          onShape={setShape}
          mode={mode}
          remove={removing}
          removable={byHand(kind, group)}
          onDone={() => setMode("view")}
        />
      </CardContent>
    </Card>
  );
}

/** The albums inside the album, at any depth; none for a tag or genre. */
function subAlbumIds(kind: GroupKind, group: Group, albums: Group[]): Set<string> {
  return kind === "albums" ? albumDescendants(albums, group.id) : new Set<string>();
}

/** Whether the group is an album, readable, with more than one photo to put in order. */
function canReorder(kind: GroupKind, group: Group, photos: unknown[] = []): boolean {
  return kind === "albums" && !group.error && photos.length > 1;
}

/** Whether an album's Photos card shows its photos, the tiles to reorder, or the ones to remove. */
type PhotosMode = "view" | "reorder" | "remove";

/** Whether the group is an album, readable, with photos to take out of it. */
function canRemove(kind: GroupKind, group: Group, photos: unknown[] = []): boolean {
  return byHand(kind, group) && photos.length > 0;
}

/**
 * Whether the group is a readable album whose photos are chosen by hand, not a Smart Album, whose
 * photos, covers and layout only its rules decide.
 */
export function byHand(kind: GroupKind, group: Group): boolean {
  return isReadableAlbum(kind, group) && !isSmartAlbum(group);
}

interface PhotosOrReorderProps extends Pick<GroupPhotos, "combined" | "photos"> {
  group: Group;
  /** The shape the quick filter shows alone while viewing, or undefined for every photo. */
  shape?: PhotoShape;
  onShape: (shape?: PhotoShape) => void;
  mode: PhotosMode;
  remove: AlbumRemove;
  /** Whether each of the album's own photos gets a button that takes it out of the album. */
  removable: boolean;
  onDone: () => void;
}

/**
 * The photos in the album's order, or, while reordering, the tiles to drag into a new one, or,
 * while removing, the tiles to pick.
 */
function PhotosOrReorder(props: PhotosOrReorderProps) {
  const { group, photos, mode, remove, onDone } = props;
  if (mode === "view" || !photos) return <ShapePhotoGrid {...props} />;
  if (mode === "reorder") {
    return <AlbumPhotoReorder album={group} photos={photos} onDone={onDone} />;
  }
  return <AlbumRemovePhotos album={group} photos={photos} remove={remove} onDone={onDone} />;
}

/** The orientation quick filter over the photos of the shape it picked, or a note when none match. */
function ShapePhotoGrid(props: PhotosOrReorderProps) {
  const { group, photos = [], shape, onShape } = props;
  const shown = photosOfShape(props.photos, shape);
  return (
    <>
      <PhotoShapeFilter photos={photos} value={shape} onChange={onShape} />
      {shown?.length === 0 && shape ? (
        <EmptyNote>{NO_PHOTOS_MATCH}</EmptyNote>
      ) : (
        <AlbumPhotoGrid {...props} photos={shown} album={group} />
      )}
    </>
  );
}

/** An album's Add photos button; none for a tag or genre, or an album that couldn't be read. */
function AddPhotosButton({
  kind,
  group,
  add,
}: { kind: GroupKind; group: Group } & Pick<AlbumAdd, "add">) {
  if (!byHand(kind, group)) return null;
  return <AlbumAddPhotos album={group} add={add} />;
}

function ReorderButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <ArrowDownUpIcon aria-hidden />
      Reorder
    </Button>
  );
}

function RemoveButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <MinusIcon aria-hidden />
      Remove photos
    </Button>
  );
}

function PhotosSource({ current }: Pick<GroupPhotos, "current">) {
  if (!current) return "Every photo whose JSON lists it.";
  return (
    <>
      From{" "}
      <a
        href={current.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        ALLPHOTOS.json
      </a>{" "}
      on {current.where}, which CI rebuilds after each save, so a new change shows here once it's
      done.
    </>
  );
}

interface SubAlbumsToggleProps {
  show: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SubAlbumsToggle({ show, checked, onChange }: SubAlbumsToggleProps) {
  if (!show) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Include sub-albums
    </label>
  );
}
