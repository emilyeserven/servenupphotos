import type { RouteSource } from "@/api/transit";
import { SourceSelect } from "@/components/source-select";
import { useRouteSourceStore } from "@/stores/route-source";

/** Where lines can be looked up, as the menu names them. */
const SOURCES: { value: RouteSource; label: string }[] = [
  { value: "overpass", label: "OpenStreetMap" },
  { value: "transitland", label: "Transitland" },
];

/**
 * Where Find lines and Look up route look: OpenStreetMap, through its often busy Overpass servers,
 * or Transitland, from the timetables transit agencies publish, which needs TRANSITLAND_API_KEY.
 * The choice is kept for every look-up.
 */
export function RouteSourcePicker() {
  const { source, setSource } = useRouteSourceStore();
  return (
    <SourceSelect
      choices={SOURCES}
      value={source}
      label="Look lines up on"
      hint="OpenStreetMap's servers are often busy; Transitland needs a free API key in .env."
      onChange={setSource}
    />
  );
}
