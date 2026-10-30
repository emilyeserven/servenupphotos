import { ImageOffIcon, XIcon } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { MoveArrows } from "@/components/move-arrows";
import { Button } from "@/components/ui/button";
import { moved } from "@/lib/album-photo-order";
import type { CombinedPhoto } from "@/lib/group-photos";
import { cn } from "@/lib/utils";

/** A photo's Square Thumbnail, or a placeholder naming its ID when it isn't one of the album's. */
export function LayoutThumbnail({
  id,
  photo,
  className,
}: {
  id: number;
  photo?: CombinedPhoto;
  className?: string;
}) {
  const square = photo ? squareUrl(photo) : undefined;
  return (
    <div className={cn("bg-muted relative aspect-square overflow-hidden rounded-md", className)}>
      {square ? (
        <img
          src={square}
          alt={photoName(photo as CombinedPhoto)}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <MissingPhoto id={id} known={Boolean(photo)} />
      )}
    </div>
  );
}

function MissingPhoto({ id, known }: { id: number; known: boolean }) {
  return (
    <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-1 text-center text-[0.625rem]">
      <ImageOffIcon className="size-4" aria-hidden />
      {known ? "No image" : `Photo ${id} isn't in this album`}
    </div>
  );
}

interface LayoutPhotoProps {
  id: number;
  photo?: CombinedPhoto;
  /** Its place in its list, 0 first. */
  place: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

/** A photo in a row or among the covers, with arrows that move it one place and a button that takes it out. */
function LayoutPhoto({ id, photo, place, last, onMove, onRemove }: LayoutPhotoProps) {
  const name = photo ? photoName(photo) : `Photo ${id}`;
  return (
    <li className="bg-card flex w-28 flex-col gap-1 rounded-lg border p-1">
      <LayoutThumbnail id={id} photo={photo} className="w-full" />
      <span className="truncate px-0.5 text-xs" title={name}>
        {name}
      </span>
      <div className="flex items-center">
        <MoveArrows name={name} place={place} last={last} onMove={onMove} />
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto"
          aria-label={`Take ${name} out`}
          onClick={onRemove}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
    </li>
  );
}

/** A list of photo IDs, each as a LayoutPhoto, changed in place by its buttons. */
export function LayoutPhotoList({
  ids,
  photos,
  onChange,
}: {
  ids: number[];
  photos: ReadonlyMap<number, CombinedPhoto>;
  onChange: (ids: number[]) => void;
}) {
  const move = (from: number, to: number) => onChange(moved(ids, from, to));
  return (
    <>
      {ids.map((id, i) => (
        <LayoutPhoto
          key={id}
          id={id}
          photo={photos.get(id)}
          place={i}
          last={i === ids.length - 1}
          onMove={move}
          onRemove={() => onChange(ids.filter((other) => other !== id))}
        />
      ))}
    </>
  );
}
