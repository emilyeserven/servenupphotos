import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { InFlightWork } from "@/api/backup";

interface InFlightBackupState {
  /**
   * Whether the pipeline has been offline (the browser or R2 couldn't reach the internet) since
   * everything was last committed. While it's true, the in-flight work is copied to `backup`.
   */
  offlineSeen: boolean;
  /** The last copy of the in-flight work kept in this browser. */
  backup?: InFlightWork;
  /** Notes that the pipeline is offline, so the in-flight work starts being kept here. */
  markOffline: () => void;
  /** Keeps work as the browser's copy. */
  keep: (work: InFlightWork) => void;
  /** Drops the browser's copy and stops keeping one, once everything is committed while online. */
  clear: () => void;
}

/**
 * A copy of the in-flight work in localStorage, kept while the pipeline is or was offline, so it
 * can be restored if the backend's own copy (`pending-changes.json`) is lost, such as with its
 * Docker volume.
 */
export const useInFlightBackupStore = create<InFlightBackupState>()(
  persist(
    (set) => ({
      offlineSeen: false,
      markOffline: () => set({ offlineSeen: true }),
      keep: (backup) => set({ backup }),
      clear: () => set({ offlineSeen: false, backup: undefined }),
    }),
    { name: "pipeline-in-flight-backup", storage: createJSONStorage(() => localStorage) },
  ),
);
