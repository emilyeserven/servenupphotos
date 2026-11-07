import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type LightroomAlbum,
  type LightroomAlbumsFile,
  type LightroomItem,
  normalizeLightroomItems,
  updateAlbum,
} from "@/lib/lightroom-albums";
import type { LightroomConnection } from "@/lib/lightroom-next-up";

/** How the Albums card shows the albums: as Lightroom's folder tree, or as a board with a lane per stage. */
export type LightroomView = "tree" | "board";

interface LightroomAlbumsState {
  /** The album tree and where it came from, or null before the first import. */
  file: LightroomAlbumsFile | null;
  /** Puts an imported tree (already merged with the current one) in place of the current one. */
  replace: (source: string, items: LightroomItem[]) => void;
  /** Changes one album's stage or notes. */
  setAlbum: (path: string, change: Partial<Pick<LightroomAlbum, "stage" | "notes">>) => void;
  /** Forgets the whole tree, with every stage and note. */
  clear: () => void;
  /** Whether the Albums card shows the tree or the board. */
  view: LightroomView;
  /** Switches between the tree and the board. */
  setView: (view: LightroomView) => void;
  /** Whether the Next up panel suggests any album, or only the ones Lightroom keeps offline. */
  connection: LightroomConnection;
  /** Switches the Next up panel between online and offline. */
  setConnection: (connection: LightroomConnection) => void;
}

/** A list saved by version 0 of the page, read again so its albums get "offline" and its stages become lanes. */
function migrate(saved: unknown): Partial<LightroomAlbumsState> {
  const state = (saved ?? {}) as Partial<LightroomAlbumsState>;
  if (!state.file) return { file: null };
  return { file: { ...state.file, items: normalizeLightroomItems(state.file.items) } };
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
      view: "tree",
      setView: (view) => set({ view }),
      connection: "online",
      setConnection: (connection) => set({ connection }),
    }),
    {
      name: "pipeline-lightroom-albums",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (saved) => migrate(saved) as LightroomAlbumsState,
    },
  ),
);
