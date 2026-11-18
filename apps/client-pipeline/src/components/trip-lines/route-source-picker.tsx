import type { RouteSource } from "@/api/transit";
import { SourceSelect } from "@/components/source-select";
import { useRouteSourceStore } from "@/stores/route-source";

/** Where lines can be looked up, as the menu names them. */
const SOURCES: { value: RouteSource; label: string }[] = [
  { value: "overpass", label: "OpenStreetMap" },
  { value: "transitland", label: "Transitland" },
  { value: "mlit", label: "Japan rail map" },
];

/**
 * Where Find lines and Look up route look: OpenStreetMap, through its often busy Overpass servers;
 * Transitland, from the timetables transit agencies publish, which needs TRANSITLAND_API_KEY; or
 * Japan's rail map (MLIT's railway data), downloaded once and read on this computer.
 * The choice is kept for every look-up.
 */
export function RouteSourcePicker() {
  const { source, setSource } = useRouteSourceStore();
  return (
    <SourceSelect
      choices={SOURCES}
      value={source}
      label="Look lines up on"
      hint="OpenStreetMap's servers are often busy; Transitland needs a free API key in .env; Japan rail map covers Japan's railways, changes of line included."
      onChange={setSource}
    />
  );
}
