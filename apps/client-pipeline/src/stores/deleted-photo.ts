import { create } from "zustand";
import type { DeletePhotoResult } from "@/api/photos";

/**
 * The photo the Photo page last deleted, so the page can say what deleting did once the photo's
 * editor is gone. Cleared when the page opens another photo.
 */
interface DeletedPhotoState {
  /** What the last delete did; null when the page hasn't deleted a photo since it opened this one. */
  result: DeletePhotoResult | null;
  setResult: (result: DeletePhotoResult | null) => void;
}

export const useDeletedPhotoStore = create<DeletedPhotoState>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
