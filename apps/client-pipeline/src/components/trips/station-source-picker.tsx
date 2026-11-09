import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import type { StationSource } from "@/api/transit";
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
    <select
      value={source}
      aria-label={`${title}: search with`}
      title="Photon is fast; Overpass tells subway and train stations apart but is often slow."
      onChange={(e) => setSource(e.target.value as StationSource)}
      className={`${SELECT_CLASS} w-auto shrink-0`}
    >
      {SOURCES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
