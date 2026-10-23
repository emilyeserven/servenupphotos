import { useNavigate } from "@tanstack/react-router";
import { Aperture, Camera } from "lucide-react";
import { FilterSelect, selectedValue } from "@/components/photo-filters";
import { RangeFilter } from "@/components/range-filter";
import { equipmentOptions } from "@/lib/filter-options";
import { photos as allPhotos, SETTING_FORMATS } from "@/lib/photos";
import type { Photo } from "@/lib/photos";
import {
  filterTable,
  RANGE_KEYS,
  type RangeKey,
  rangeValues,
  type TableFilters,
  withoutTableFilter,
} from "@/lib/table-filters";

/** Each range slider's name. */
const RANGE_LABELS: Record<RangeKey, string> = {
  iso: "ISO",
  exposure: "Exposure",
  focalLength: "Focal length",
  aperture: "Aperture",
};

/**
 * A setting's value as a photographer writes it, such as "f/5.6" or "1/60s". ISO is just the
 * number, as the slider's name already says ISO.
 */
function writeSetting(key: RangeKey): (value: string) => string {
  const write = SETTING_FORMATS.find(([name]) => name === key && key !== "iso")?.[1];
  return (value) => (write ? write(value) : value);
}

/** The steps of each slider: every value the portfolio's photos have, so they don't move as filters change. */
const RANGE_VALUES = Object.fromEntries(
  RANGE_KEYS.map((key) => [key, rangeValues(allPhotos, key)]),
) as Record<RangeKey, string[]>;

/** Sets one of the Table's own filters in the URL, keeping everything else. */
function useSetTableFilter() {
  const navigate = useNavigate();
  return (key: keyof TableFilters, value: string | undefined) => {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, [key]: value }),
    });
  };
}

/**
 * The Table's own filters, after the shared ones: **Camera** and **Lens** dropdowns, and a range
 * slider for each of ISO, exposure, focal length and aperture. `photos` is the photos the shared
 * filters leave, which the camera and lens counts are out of, given the other filters here.
 */
export function TableFilterControls({
  photos,
  filters,
}: {
  photos: Photo[];
  filters: TableFilters;
}) {
  const setFilter = useSetTableFilter();
  return (
    <>
      <EquipmentSelect equipment="camera" photos={photos} filters={filters} onChange={setFilter} />
      <EquipmentSelect equipment="lens" photos={photos} filters={filters} onChange={setFilter} />
      <div className="flex w-full flex-wrap gap-2">
        {RANGE_KEYS.map((key) => (
          <RangeFilter
            key={key}
            label={RANGE_LABELS[key]}
            values={RANGE_VALUES[key]}
            range={filters[key]}
            write={writeSetting(key)}
            onChange={(range) => setFilter(key, range)}
          />
        ))}
      </div>
    </>
  );
}

/** Each equipment dropdown's name and icon. */
const EQUIPMENT = {
  camera: { label: "Camera", Icon: Camera },
  lens: { label: "Lens", plural: "lenses", Icon: Aperture },
} as const;

/** The **Camera** or **Lens** dropdown, each choice counting what the other filters leave. */
function EquipmentSelect({
  equipment,
  photos,
  filters,
  onChange,
}: {
  equipment: "camera" | "lens";
  photos: Photo[];
  filters: TableFilters;
  onChange: (key: keyof TableFilters, value: string | undefined) => void;
}) {
  const facet = filterTable(photos, withoutTableFilter(filters, equipment));
  const options = equipmentOptions(equipment, allPhotos, facet);
  const prefix = `${equipment}:`;
  return (
    <FilterSelect
      {...EQUIPMENT[equipment]}
      options={options}
      selected={selectedValue(options, filters)}
      onChange={(selected) => onChange(equipment, selected.slice(prefix.length) || undefined)}
    />
  );
}
