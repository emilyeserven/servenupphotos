import { create } from "zustand";

/**
 * A photo chosen with the sidebar's Upload button, waiting for the Photo page to pick it up as if
 * it had been chosen there.
 */
interface PendingPhotoState {
  photo: File | null;
  /** Hands photo to the Photo page. */
  choose: (photo: File) => void;
  /** The waiting photo, which is no longer waiting once taken; null when there's none. */
  take: () => File | null;
}

export const usePendingPhotoStore = create<PendingPhotoState>()((set, get) => ({
  photo: null,
  choose: (photo) => set({ photo }),
  take: () => {
    const { photo } = get();
    if (photo) set({ photo: null });
    return photo;
  },
}));
