import type { StationSource } from "@/api/transit";
import { SourceSelect } from "@/components/source-select";
import { useStationSourceStore } from "@/stores/station-source";

/** The services a station search can ask, as the menu names them. */
const SOURCES: { value: StationSource; label: string }[] = [
  { value: "photon", label: "Photon" },
  { value: "overpass", label: "Overpass" },
];

/**
 * Which service Find a station asks: Photon, which is fast but can't tell subway stations from
 * train stations, or Overpass, which can but is often slow. The choice is kept for every search.
 */
export function StationSourcePicker({ title }: { title: string }) {
  const { source, setSource } = useStationSourceStore();
  return (
    <SourceSelect
      choices={SOURCES}
      value={source}
      label={`${title}: search with`}
      hint="Photon is fast; Overpass tells subway and train stations apart but is often slow."
      onChange={setSource}
    />
  );
}
