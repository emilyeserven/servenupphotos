import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RouteSource } from "@/api/transit";

interface RouteSourceState {
  /** Where Find lines and Look up route look: OpenStreetMap's Overpass servers, or Transitland. */
  source: RouteSource;
  setSource: (source: RouteSource) => void;
}

/**
 * Where lines and routes are looked up, kept in the browser so it stays picked after a reload.
 * OpenStreetMap is the default, since Transitland needs an API key.
 */
export const useRouteSourceStore = create<RouteSourceState>()(
  persist(
    (set) => ({
      source: "overpass",
      setSource: (source) => set({ source }),
    }),
    { name: "pipeline-route-source", storage: createJSONStorage(() => localStorage) },
  ),
);
