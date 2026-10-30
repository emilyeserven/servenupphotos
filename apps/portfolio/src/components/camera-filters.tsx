import { useNavigate, useSearch } from "@tanstack/react-router";
import { Aperture, Camera } from "lucide-react";
import type { ReactNode } from "react";
import {
  FilterSelect,
  type OwnFilters,
  PhotoFilterBar,
  selectedValue,
} from "@portfolio/components/photo-filters";
import { RangeFilter } from "@portfolio/components/range-filter";
import type { RangePreset } from "@portfolio/components/range-presets";
import { equipmentOptions } from "@portfolio/lib/filter-options";
import { groupTree } from "@portfolio/lib/metadata-groups";
import { photos as allPhotos, SETTING_FORMATS } from "@portfolio/lib/photos";
import type { Photo } from "@portfolio/lib/photos";
import { filterPhotos, parseFilters } from "@portfolio/lib/photo-filters";
import {
  CAMERA_FILTER_KEYS,
  type EquipmentKey,
  filterByCamera,
  groupRange,
  parseRange,
  RANGE_KEYS,
  type RangeKey,
  rangeValues,
  type CameraFilters,
  parseCameraFilters,
  TIME_KEY,
  withoutCameraFilters,
} from "@portfolio/lib/camera-filters";
import { hourEnd, hourStart, photoHours } from "@portfolio/lib/time-of-day";

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

/** The steps of the **Time of day** slider: every hour of the day a portfolio photo was taken in. */
const HOUR_VALUES = photoHours(allPhotos);

/**
 * A quick pick's range as the photos write its ends, such as "11mm – 24mm" or "250 – 1600 ISO", or
 * the one value when they're the same.
 */
function spanText(key: RangeKey, range: string): string {
  const write = writeSetting(key);
  const [low = "", high = ""] = parseRange(range) ?? [];
  const text = low === high ? write(low) : `${write(low)} – ${write(high)}`;
  return key === "iso" ? `${text} ISO` : text;
}

/** Each slider's quick picks: the metadata groups of its setting with photos in their range. */
const RANGE_PRESETS = Object.fromEntries(
  RANGE_KEYS.map((key) => [
    key,
    groupTree(key).flatMap(([group]): RangePreset[] => {
      const range = groupRange(key, group, RANGE_VALUES[key]);
      // A group no photo is in isn't shown.
      if (!range) return [];
      return [{ id: group.id, name: group.name, span: spanText(key, range), range }];
    }),
  ]),
) as Record<RangeKey, RangePreset[]>;

/** Sets some of the camera filters in the URL, keeping everything else. */
function useSetCameraFilters() {
  const navigate = useNavigate();
  return (next: CameraFilters) => {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
    });
  };
}

/**
 * The camera filters, after the shared ones on the Table and Grid: **Camera** and **Lens** dropdowns, with the
 * metadata groups of each, a range slider for each of ISO, exposure, focal length and
 * aperture, with its range groups as quick picks, and one for the time of day. `photos` is the photos the shared
 * filters leave, which the camera and lens counts are out of, given the other filters here.
 * `children` go after the sliders, in the same row, such as the Grid's **Colors**.
 */
function CameraFilterControls({
  photos,
  filters,
  children,
}: {
  photos: Photo[];
  filters: CameraFilters;
  children: ReactNode;
}) {
  const setFilters = useSetCameraFilters();
  return (
    <>
      <EquipmentSelect equipment="camera" photos={photos} filters={filters} onChange={setFilters} />
      <EquipmentSelect equipment="lens" photos={photos} filters={filters} onChange={setFilters} />
      <div className="flex w-full flex-wrap items-start gap-2">
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
        <RangeFilter
          label="Time of day"
          values={HOUR_VALUES}
          range={filters[TIME_KEY]}
          write={hourStart}
          writeHigh={hourEnd}
          presets={[]}
          onChange={(range) => setFilters({ [TIME_KEY]: range })}
        />
        {children}
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
function equipmentFilters(equipment: EquipmentKey, selected: string): CameraFilters {
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
  filters: CameraFilters;
  onChange: (next: CameraFilters) => void;
}) {
  const own = [equipment, `${equipment}Group`] as const;
  const facet = filterByCamera(photos, withoutCameraFilters(filters, own));
  const options = equipmentOptions(equipment, allPhotos, facet, {
    group: filters[`${equipment}Group`],
    name: filters[equipment],
  });
  return (
    <FilterSelect
      {...EQUIPMENT[equipment]}
      options={options}
      selected={selectedValue(options, filters)}
      onChange={(selected) => onChange(equipmentFilters(equipment, selected))}
    />
  );
}

const NO_EXTRA: OwnFilters = { keys: [], count: 0, children: null };

/**
 * The filter bar of the Table and Grid: the shared filters every view has, then the camera
 * filters, all in one **Show filters** panel, so both views always offer the same ones. `extra`
 * are a view's own filters after those, in the sliders' row, such as the Grid's **Colors**.
 */
export function CameraFilterBar({
  photos,
  extra = NO_EXTRA,
}: {
  photos: Photo[];
  extra?: OwnFilters;
}) {
  const search = useSearch({ strict: false });
  const own = parseCameraFilters(search);
  return (
    <PhotoFilterBar
      photos={photos}
      facet={filterByCamera(photos, own)}
      own={{
        keys: [...CAMERA_FILTER_KEYS, ...extra.keys],
        count: Object.keys(own).length + extra.count,
        children: (
          <CameraFilterControls photos={filterPhotos(photos, parseFilters(search))} filters={own}>
            {extra.children}
          </CameraFilterControls>
        ),
      }}
    />
  );
}
