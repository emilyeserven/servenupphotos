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
import { insertAlbum, moveAlbum, removeAlbum, removeFolder } from "@/lib/lightroom-tree";

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
  /** Adds an album by hand, starting a list when there isn't one yet. */
  addAlbum: (album: LightroomAlbum) => void;
  /** Removes an album, such as one added by hand by mistake. */
  removeAlbum: (path: string) => void;
  /** Deletes a folder with every folder and album inside it. */
  removeFolder: (path: string) => void;
  /** Moves an album into another folder, or "" for no parent, making the folder when it isn't there yet. */
  moveAlbum: (path: string, folder: string) => void;
  /** The paths of the folders closed in the tree. */
  closedFolders: string[];
  /** Opens or closes one folder in the tree. */
  toggleFolder: (path: string) => void;
  /** Sets which folders are closed, such as all of them or none. */
  setClosedFolders: (paths: string[]) => void;
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

/** The list with its tree changed and its time of change set to now. */
function changed(
  file: LightroomAlbumsFile,
  change: (items: LightroomItem[]) => LightroomItem[],
): LightroomAlbumsFile {
  return { ...file, items: change(file.items), updatedAt: new Date().toISOString() };
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
          file: state.file && changed(state.file, (items) => updateAlbum(items, path, change)),
        })),
      clear: () => set({ file: null }),
      addAlbum: (album) =>
        set((state) => ({
          file: changed(state.file ?? { source: "manual", updatedAt: "", items: [] }, (items) =>
            insertAlbum(items, album),
          ),
        })),
      removeAlbum: (path) =>
        set((state) => ({
          file: state.file && changed(state.file, (items) => removeAlbum(items, path)),
        })),
      removeFolder: (path) =>
        set((state) => ({
          file: state.file && changed(state.file, (items) => removeFolder(items, path)),
          closedFolders: state.closedFolders.filter((p) => p !== path),
        })),
      moveAlbum: (path, folder) =>
        set((state) => ({
          file: state.file && changed(state.file, (items) => moveAlbum(items, path, folder)),
        })),
      closedFolders: [],
      toggleFolder: (path) =>
        set((state) => ({
          closedFolders: state.closedFolders.includes(path)
            ? state.closedFolders.filter((p) => p !== path)
            : [...state.closedFolders, path],
        })),
      setClosedFolders: (closedFolders) => set({ closedFolders }),
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
