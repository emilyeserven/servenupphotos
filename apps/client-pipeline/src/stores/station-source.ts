import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StationSource } from "@/api/transit";

interface StationSourceState {
  /** The service station searches ask: Photon, or OpenStreetMap's Overpass servers. */
  source: StationSource;
  setSource: (source: StationSource) => void;
}

/**
 * Which service Find a station asks, kept in the browser so it stays picked after a reload. Photon
 * is the default: it answers in about a second, where the public Overpass servers can take a minute.
 */
export const useStationSourceStore = create<StationSourceState>()(
  persist(
    (set) => ({
      source: "photon",
      setSource: (source) => set({ source }),
    }),
    { name: "pipeline-station-source", storage: createJSONStorage(() => localStorage) },
  ),
);
