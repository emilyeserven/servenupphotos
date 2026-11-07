import { useState } from "react";
import type { GearCrop, GearFile } from "@portfolio/lib/gear-pictures";
import { sameCrop } from "@/lib/gear-crop";

/** A picture in the Crops card: its file, the original crops are cut from, and its crop now. */
export interface CropEntry {
  file: GearFile;
  /** The picture as uploaded, or the file's picture itself when it's from before crops. */
  original: string;
  /** The crop lined up, or none until a picture from before crops has loaded. */
  crop?: GearCrop;
  /** Whether the crop differs from the one the file has saved. */
  changed: boolean;
}

/** The files with a picture to crop: every one but those showing the drawing. */
function pictured(files: GearFile[]): GearFile[] {
  return files.filter((file) => Boolean(file.original ?? file.image));
}

/** A file's entry, with the crop lined up for it if there is one, else its saved crop. */
function entryOf(file: GearFile, edited: Record<string, GearCrop>): CropEntry {
  const crop = edited[file.id] ?? file.crop;
  return {
    file,
    original: file.original ?? file.image,
    crop,
    changed: !sameCrop(crop, file.crop),
  };
}

/** Changes the crops of the chosen entries with `change`, leaving the others as they are. */
function changeChosen(
  entries: CropEntry[],
  chosen: Set<string>,
  change: (entry: CropEntry) => GearCrop | undefined,
): Record<string, GearCrop> {
  const out: Record<string, GearCrop> = {};
  for (const entry of entries.filter((e) => chosen.has(e.file.id))) {
    const crop = change(entry);
    if (crop) out[entry.file.id] = crop;
  }
  return out;
}

/**
 * The Crops card's state: every picture's crop, edited ones over saved ones, the pictures chosen
 * (unfaded, and moved, zoomed and fitted together), and each picture's size once it has loaded.
 */
export function useBulkCrop(files: GearFile[]) {
  const [edited, setEdited] = useState<Record<string, GearCrop>>({});
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [sizes, setSizes] = useState<Record<string, [number, number]>>({});
  const entries = pictured(files).map((file) => entryOf(file, edited));
  return {
    entries,
    chosen,
    sizes,
    /** Chooses a picture, or lets it go. */
    toggle: (id: string) =>
      setChosen((now) => {
        const next = new Set(now);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    /** Chooses every picture, or none. */
    chooseAll: (all: boolean) =>
      setChosen(all ? new Set(entries.map((e) => e.file.id)) : new Set()),
    /** Changes every chosen picture's crop. */
    change: (change: (entry: CropEntry) => GearCrop | undefined) =>
      setEdited((now) => ({ ...now, ...changeChosen(entries, chosen, change) })),
    /** Sets one picture's crop, such as its first once it has loaded. */
    set: (id: string, crop: GearCrop) => setEdited((now) => ({ ...now, [id]: crop })),
    /** Notes a picture's size once it has loaded. */
    sized: (id: string, size: [number, number]) => setSizes((now) => ({ ...now, [id]: size })),
    /** Puts the chosen pictures' crops back as saved. */
    reset: () =>
      setEdited((now) => Object.fromEntries(Object.entries(now).filter(([id]) => !chosen.has(id)))),
  };
}

/** The Crops card's state: what useBulkCrop gives. */
export type BulkCrop = ReturnType<typeof useBulkCrop>;
