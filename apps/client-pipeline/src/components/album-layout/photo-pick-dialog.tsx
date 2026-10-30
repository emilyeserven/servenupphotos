import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { photoName } from "@/components/group-photo-grid";
import { LayoutThumbnail } from "@/components/album-layout/layout-photo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { photoId } from "@/lib/album-photo-order";
import type { CombinedPhoto } from "@/lib/group-photos";
import { cn } from "@/lib/utils";

interface PhotoPickDialogProps {
  /** The button's text, such as "Add photos". */
  label: string;
  title: string;
  description: string;
  /** The photos to pick from, in the album's order. */
  choices: CombinedPhoto[];
  /** How many can be picked. */
  max: number;
  onPick: (ids: number[]) => void;
}

/** A button that opens the album's photos as thumbnails to pick up to max of, in the order they're clicked. */
export function PhotoPickDialog({
  label,
  title,
  description,
  choices,
  max,
  onPick,
}: PhotoPickDialogProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (id: number) =>
    setPicked((list) => (list.includes(id) ? list.filter((other) => other !== id) : [...list, id]));
  const change = (next: boolean) => {
    setOpen(next);
    setPicked([]);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={max < 1 || choices.length === 0}>
          <PlusIcon aria-hidden />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <PickGrid choices={choices} picked={picked} full={picked.length >= max} onToggle={toggle} />
        <DialogFooter>
          <Button
            disabled={picked.length === 0}
            onClick={() => {
              onPick(picked);
              change(false);
            }}
          >
            {pickText(picked.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pickText(count: number): string {
  if (count === 0) return "Pick photos";
  return count === 1 ? "Add 1 photo" : `Add ${count} photos`;
}

interface PickGridProps {
  choices: CombinedPhoto[];
  picked: number[];
  /** Whether as many as can be picked are, so the rest can't be. */
  full: boolean;
  onToggle: (id: number) => void;
}

function PickGrid({ choices, picked, full, onToggle }: PickGridProps) {
  return (
    <ul className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
      {choices.flatMap((photo) => {
        const id = photoId(photo);
        if (id === undefined) return [];
        const place = picked.indexOf(id);
        return (
          <li key={id}>
            <PickTile
              id={id}
              photo={photo}
              place={place}
              disabled={full && place === -1}
              onToggle={onToggle}
            />
          </li>
        );
      })}
    </ul>
  );
}

interface PickTileProps {
  id: number;
  photo: CombinedPhoto;
  /** Its place among the picked photos, 0 first, or -1 when it isn't picked. */
  place: number;
  disabled: boolean;
  onToggle: (id: number) => void;
}

function PickTile({ id, photo, place, disabled, onToggle }: PickTileProps) {
  const name = photoName(photo);
  return (
    <button
      type="button"
      aria-pressed={place !== -1}
      disabled={disabled}
      onClick={() => onToggle(id)}
      className={cn(
        "focus-visible:ring-ring relative flex w-full flex-col gap-1 rounded-lg border p-1 text-left outline-none focus-visible:ring-2 disabled:opacity-40",
        place !== -1 && "border-primary ring-primary ring-2",
      )}
    >
      <LayoutThumbnail id={id} photo={photo} className="w-full" />
      <span className="truncate text-xs" title={name}>
        {name}
      </span>
      <PickedMark place={place} />
    </button>
  );
}

/** The picked photo's place, 1 first, in the corner. */
function PickedMark({ place }: { place: number }) {
  if (place === -1) return null;
  return (
    <span className="bg-primary text-primary-foreground absolute top-2 left-2 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded px-1 text-xs font-medium tabular-nums">
      <CheckIcon className="size-3" aria-hidden />
      {place + 1}
    </span>
  );
}
