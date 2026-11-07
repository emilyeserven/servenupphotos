import { useState } from "react";
import type { GearCrop, GearFile } from "@portfolio/lib/gear-pictures";
import { sameCrop } from "@/lib/gear-crop";

/** A picture in the Crops card: its file, the original crops are cut from, and its crop now. */
export interface CropEntry {
  file: GearFile;
  /** The picture as uploaded, at its full size, which every sized version is cut from. */
  original: string;
  /** The crop lined up, or none until a picture from before crops has loaded. */
  crop?: GearCrop;
  /** Whether the crop differs from the one the file has saved. */
  changed: boolean;
}

/** A file whose picture was kept as uploaded, so it can be sized from its full-size original. */
type OriginalFile = GearFile & { original: string };

/**
 * The files that can be sized: those with their original kept. A file saved before originals were
 * kept has only a resized picture, and is left out until its picture is uploaded again.
 */
function withOriginals(files: GearFile[]): OriginalFile[] {
  return files.filter((file): file is OriginalFile => Boolean(file.original));
}

/** A file's entry, with the crop lined up for it if there is one, else its saved crop. */
function entryOf(file: OriginalFile, edited: Record<string, GearCrop>): CropEntry {
  const crop = edited[file.id] ?? file.crop;
  return {
    file,
    original: file.original,
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
 * The sizing card's state: every picture's crop, edited ones over saved ones; the pictures chosen
 * (unfaded, and fitted, filled and reset together); the one picture being edited (dragged and
 * zoomed on its own); and each picture's size once it has loaded.
 */
export function useBulkCrop(files: GearFile[]) {
  const [edited, setEdited] = useState<Record<string, GearCrop>>({});
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<string>();
  const [sizes, setSizes] = useState<Record<string, [number, number]>>({});
  const entries = withOriginals(files).map((file) => entryOf(file, edited));
  const current = entries.find((entry) => entry.file.id === editing);
  return {
    entries,
    chosen,
    sizes,
    /** The picture being edited, if any. */
    current,
    /** How many pictures can't be sized, having no original kept. */
    missing: files.filter((file) => file.image && !file.original).length,
    /** Edits a picture, choosing it too. */
    edit: (id: string) => {
      setEditing(id);
      setChosen((now) => new Set(now).add(id));
    },
    /** Changes the crop of the picture being edited, and no other. */
    changeCurrent: (change: (crop: GearCrop) => GearCrop) => {
      if (current?.crop)
        setEdited((now) => ({ ...now, [current.file.id]: change(current.crop as GearCrop) }));
    },
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
