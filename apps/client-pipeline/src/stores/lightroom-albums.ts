import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type LightroomAlbum,
  type LightroomAlbumsFile,
  type LightroomItem,
  updateAlbum,
} from "@/lib/lightroom-albums";

interface LightroomAlbumsState {
  /** The album tree and where it came from, or null before the first import. */
  file: LightroomAlbumsFile | null;
  /** Puts an imported tree (already merged with the current one) in place of the current one. */
  replace: (source: string, items: LightroomItem[]) => void;
  /** Changes one album's stage or notes. */
  setAlbum: (path: string, change: Partial<Pick<LightroomAlbum, "stage" | "notes">>) => void;
  /** Forgets the whole tree, with every stage and note. */
  clear: () => void;
}

/**
 * The Lightroom Albums page's tree, with each album's stage and notes. It's kept only in this browser's
 * localStorage and is never sent to the backend or GitHub; Export and Import carry it to another computer.
 */
export const useLightroomAlbumsStore = create<LightroomAlbumsState>()(
  persist(
    (set) => ({
      file: null,
      replace: (source, items) =>
        set({ file: { source, items, updatedAt: new Date().toISOString() } }),
      setAlbum: (path, change) =>
        set((state) => ({
          file: state.file && {
            ...state.file,
            items: updateAlbum(state.file.items, path, change),
            updatedAt: new Date().toISOString(),
          },
        })),
      clear: () => set({ file: null }),
    }),
    { name: "pipeline-lightroom-albums", storage: createJSONStorage(() => localStorage) },
  ),
);
