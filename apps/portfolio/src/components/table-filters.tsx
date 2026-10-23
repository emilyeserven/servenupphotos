import { useNavigate } from "@tanstack/react-router";
import { Aperture, Camera } from "lucide-react";
import { FilterSelect, selectedValue } from "@/components/photo-filters";
import { RangeFilter } from "@/components/range-filter";
import type { RangePreset } from "@/components/range-presets";
import { equipmentOptions } from "@/lib/filter-options";
import { groupTree } from "@/lib/metadata-groups";
import { photos as allPhotos, SETTING_FORMATS } from "@/lib/photos";
import type { Photo } from "@/lib/photos";
import {
  type EquipmentKey,
  filterTable,
  groupRange,
  groupSpan,
  RANGE_KEYS,
  type RangeKey,
  rangeValues,
  type TableFilters,
  withoutTableFilters,
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

/** An exposure of a metadata group, in seconds, as the photos write it: 0.004 is "1/250". */
function exposureText(seconds: number): string {
  return seconds < 1 ? `1/${Math.round(1 / seconds)}` : String(seconds);
}

/**
 * A range group's ends as a photographer writes them, such as "10mm–24mm", the one value,
 * "≥ 12800" for one with no top, or "≤ 1/250s" for one from 0 or with no bottom.
 */
function spanText(key: RangeKey, [low, high]: [number, number]): string {
  const write = writeSetting(key);
  const text = (end: number) => write(key === "exposure" ? exposureText(end) : String(end));
  if (high === Number.POSITIVE_INFINITY) return `≥ ${text(low)}`;
  if (low <= 0) return `≤ ${text(high)}`;
  return low === high ? text(low) : `${text(low)}–${text(high)}`;
}

/** Each slider's quick picks: the metadata groups of its setting with photos in their range. */
const RANGE_PRESETS = Object.fromEntries(
  RANGE_KEYS.map((key) => [
    key,
    groupTree(key).flatMap(([group]): RangePreset[] => {
      const span = groupSpan(key, group);
      const range = span && groupRange(key, group, RANGE_VALUES[key]);
      // A group no photo is in isn't shown.
      if (!span || !range) return [];
      return [{ id: group.id, name: group.name, span: spanText(key, span), range }];
    }),
  ]),
) as Record<RangeKey, RangePreset[]>;

/** Sets some of the Table's own filters in the URL, keeping everything else. */
function useSetTableFilters() {
  const navigate = useNavigate();
  return (next: TableFilters) => {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
    });
  };
}

/**
 * The Table's own filters, after the shared ones: **Camera** and **Lens** dropdowns, with the
 * metadata groups of each, and a range slider for each of ISO, exposure, focal length and
 * aperture, with its range groups as quick picks. `photos` is the photos the shared
 * filters leave, which the camera and lens counts are out of, given the other filters here.
 */
export function TableFilterControls({
  photos,
  filters,
}: {
  photos: Photo[];
  filters: TableFilters;
}) {
  const setFilters = useSetTableFilters();
  return (
    <>
      <EquipmentSelect equipment="camera" photos={photos} filters={filters} onChange={setFilters} />
      <EquipmentSelect equipment="lens" photos={photos} filters={filters} onChange={setFilters} />
      <div className="flex w-full flex-wrap gap-2">
        {RANGE_KEYS.map((key) => (
          <RangeFilter
            key={key}
            label={RANGE_LABELS[key]}
            values={RANGE_VALUES[key]}
            range={filters[key]}
            write={writeSetting(key)}
            presets={RANGE_PRESETS[key]}
            onChange={(range) => setFilters({ [key]: range })}
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

/**
 * The filters a camera or lens dropdown's value sets, such as "lensGroup:lens-zoom" or
 * "lens:EF50mm f/1.8 II", clearing the other of the name and the group.
 */
function equipmentFilters(equipment: EquipmentKey, selected: string): TableFilters {
  const [key = "", value] = selected.split(/:(.*)/s, 2);
  return { [equipment]: undefined, [`${equipment}Group`]: undefined, [key]: value };
}

/** The **Camera** or **Lens** dropdown, each choice counting what the other filters leave. */
function EquipmentSelect({
  equipment,
  photos,
  filters,
  onChange,
}: {
  equipment: EquipmentKey;
  photos: Photo[];
  filters: TableFilters;
  onChange: (next: TableFilters) => void;
}) {
  const own = [equipment, `${equipment}Group`] as const;
  const facet = filterTable(photos, withoutTableFilters(filters, own));
  const options = equipmentOptions(equipment, allPhotos, facet, filters[`${equipment}Group`]);
  return (
    <FilterSelect
      {...EQUIPMENT[equipment]}
      options={options}
      selected={selectedValue(options, filters)}
      onChange={(selected) => onChange(equipmentFilters(equipment, selected))}
    />
  );
}
