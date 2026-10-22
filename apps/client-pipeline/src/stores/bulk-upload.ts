import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { BULK_STEPS, type BulkPhoto, failure, isJpeg } from "@/lib/bulk-upload";

/**
 * The photos chosen on Bulk Upload. They're worked through one at a time, in the order chosen, so
 * saves to the photo data pull request never race each other. The queue lives here rather than on
 * the page, so it keeps going while you look at other pages, such as Edit Photo.
 */
interface BulkUploadState {
  photos: BulkPhoto[];
  /** Adds photos to the end of the queue and starts on them; anything but a JPEG fails right away. */
  add: (files: File[], queryClient: QueryClient) => void;
  /**
   * Adds a photo already analyzed on the Photo page to the end of the queue, with its details,
   * square, albums and tags, so it's uploaded and saved even after leaving the page.
   */
  addAnalyzed: (photo: AnalyzedPhoto, queryClient: QueryClient) => void;
  /** Puts a failed photo back in the queue; with keepSameName, its upload keeps the name R2 has. */
  retry: (id: string, queryClient: QueryClient, keepSameName?: boolean) => void;
  /** Takes a photo that's waiting or finished off the list. */
  remove: (id: string) => void;
  /** Takes every added and skipped photo off the list. */
  clearFinished: () => void;
}

/** A photo from the Photo page, with what was chosen for it there. */
export type AnalyzedPhoto = Pick<BulkPhoto, "file" | "exif" | "crop" | "groups">;

let nextId = 0;

type BulkStepRun = (typeof BULK_STEPS)[number];

/** Whether a step ended the photo's run, by skipping it or failing. */
function stopped({ step }: Partial<BulkPhoto>): boolean {
  return step === "skipped" || step === "failed";
}

function queued(file: File): BulkPhoto {
  const id = `bulk-${++nextId}`;
  if (isJpeg(file)) return { id, file, step: "waiting" };
  return { id, file, step: "failed", error: "Only JPEG photos are supported.", retryable: false };
}

export const useBulkUploadStore = create<BulkUploadState>()((set, get) => {
  const update = (id: string, patch: Partial<BulkPhoto>) =>
    set((state) => ({
      photos: state.photos.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)),
    }));
  const find = (id: string) => get().photos.find((photo) => photo.id === id);

  /** Runs one step on the photo when it still needs it, saving what the step found. */
  const runStep = async (
    id: string,
    { step, needed, run }: BulkStepRun,
    queryClient: QueryClient,
  ) => {
    const photo = find(id);
    if (!photo || !needed(photo)) return {};
    update(id, { step });
    const result = await run(photo, queryClient).catch(failure);
    update(id, result);
    return result;
  };

  /** Runs the steps the photo still needs, stopping at a skip or a failure. */
  const process = async (id: string, queryClient: QueryClient) => {
    for (const step of BULK_STEPS) {
      if (stopped(await runStep(id, step, queryClient))) return;
    }
  };

  let draining = false;
  /** Works through the waiting photos one at a time, unless that's already going. */
  const drain = async (queryClient: QueryClient) => {
    if (draining) return;
    draining = true;
    try {
      for (let next = nextWaiting(); next; next = nextWaiting())
        await process(next.id, queryClient);
    } finally {
      draining = false;
    }
  };
  const nextWaiting = () => get().photos.find((photo) => photo.step === "waiting");

  return {
    photos: [],
    add: (files, queryClient) => {
      set((state) => ({ photos: [...state.photos, ...files.map(queued)] }));
      void drain(queryClient);
    },
    addAnalyzed: (photo, queryClient) => {
      const queuedPhoto: BulkPhoto = { ...photo, id: `bulk-${++nextId}`, step: "waiting" };
      set((state) => ({ photos: [...state.photos, queuedPhoto] }));
      void drain(queryClient);
    },
    retry: (id, queryClient, keepSameName) => {
      update(id, { step: "waiting", error: undefined, sameName: [], keepSameName });
      void drain(queryClient);
    },
    remove: (id) => set((state) => ({ photos: state.photos.filter((photo) => photo.id !== id) })),
    clearFinished: () =>
      set((state) => ({
        photos: state.photos.filter((photo) => photo.step !== "added" && photo.step !== "skipped"),
      })),
  };
});
