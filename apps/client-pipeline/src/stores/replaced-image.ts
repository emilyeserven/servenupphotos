import { create } from "zustand";

/**
 * The last image a photo's own was replaced with on the Photo page, by the photo JSON file's path,
 * so the editor can still say so after it starts over with the new image.
 */
interface ReplacedImageState {
  /** The file name of the image each photo's was replaced with, by its JSON file's path. */
  replaced: Record<string, string>;
  /** Notes that the photo at path had its image replaced with the file called name. */
  note: (path: string, name: string) => void;
}

export const useReplacedImageStore = create<ReplacedImageState>()((set) => ({
  replaced: {},
  note: (path, name) => set((state) => ({ replaced: { ...state.replaced, [path]: name } })),
}));
