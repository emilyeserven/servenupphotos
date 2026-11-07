import type { ReactNode } from "react";
import { EquipmentInfoPane } from "@portfolio/components/equipment-info-pane";
import { EquipmentList } from "@portfolio/components/equipment-list";
import { InfoButton } from "@portfolio/components/info-button";
import type {
  CameraPickerProps,
  CameraSection,
  PickerPartProps,
} from "@portfolio/components/camera-picker";
import {
  RANGE_LABELS,
  RANGE_PRESETS,
  RANGE_VALUES,
  writeSetting,
} from "@portfolio/components/camera-ranges";
import { RangeFilter } from "@portfolio/components/range-filter";
import { SettingIllustration } from "@portfolio/components/setting-graphics";
import { RangePresetList } from "@portfolio/components/range-presets";
import { type EquipmentKey, parseRange, type RangeKey } from "@portfolio/lib/camera-filters";
import { equipmentChoices } from "@portfolio/lib/camera-picker";
import type { FilterOption } from "@portfolio/lib/filter-options";

/** The right side of the Camera picker: the chosen section's choices. */
export function CameraPickerPart({
  section,
  ...props
}: PickerPartProps & { section: CameraSection }) {
  if (section === "camera" || section === "lens") {
    return <EquipmentPart key={section} equipment={section} {...props} />;
  }
  return <RangePart key={section} setting={section} {...props} />;
}

/** Each equipment list's title. */
const TITLES: Record<EquipmentKey, string> = { camera: "Cameras", lens: "Lenses" };

/**
 * Every camera or lens group and name, indented under the group it's in, with how many photos
 * each would show; clicking the chosen one again goes back to all. Choices that would show no
 * photos, given the other filters, are left out, unless chosen, behind a button that shows them
 * dimmed, each saying on hover which filters hide it. The title row has Group by, Sort and the
 * (i) button, whose info pane shows the camera or lens pointed at, or else the chosen one.
 */
function EquipmentPart({
  equipment,
  graphics,
  onGraphics,
  onDrag: _onDrag,
  ...props
}: PickerPartProps & { equipment: EquipmentKey }) {
  return (
    <EquipmentList
      equipment={equipment}
      header={(controls) => (
        <PartTitle label={TITLES[equipment]} on={graphics} onClick={() => onGraphics(!graphics)}>
          {controls}
        </PartTitle>
      )}
      {...props}
    />
  );
}

/** A section's title, with `children` (such as Group by and Sort) and then the (i) button to its right. */
function PartTitle({
  label,
  on,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <h3 className="mr-auto text-sm font-semibold">{label}</h3>
      {children}
      <InfoButton open={on} label={`info about ${label}`} onClick={onClick} />
    </div>
  );
}

/** The ends of the range the filters set, or every value's when they set none. */
function setEnds(values: string[], range: string | undefined): [string, string] {
  return parseRange(range) ?? [values[0] ?? "", values.at(-1) ?? ""];
}

/** A camera setting's slider, with its quick picks listed under it. */
function RangePart({
  setting,
  filters,
  graphics,
  onGraphics,
  onChange,
  onDrag,
}: PickerPartProps & { setting: RangeKey }) {
  const label = RANGE_LABELS[setting];
  const set = (range: string | undefined) => onChange({ [setting]: range });
  return (
    <div className="flex flex-col gap-3">
      <PartTitle label={label} on={graphics} onClick={() => onGraphics(!graphics)} />
      <RangeFilter
        label={label}
        values={RANGE_VALUES[setting]}
        range={filters[setting]}
        write={writeSetting(setting)}
        onDrag={onDrag}
        onChange={set}
      />
      <RangePresetList
        label={label}
        presets={RANGE_PRESETS[setting]}
        range={filters[setting]}
        onChange={set}
      />
    </div>
  );
}

/** What the info pane shows for a section, beside the picker's controls. */
interface AsideProps extends CameraPickerProps {
  section: CameraSection;
  /** The camera or lens pointed at, if any. */
  pointed?: FilterOption;
  /** A slider's ends while a handle is dragged, if one is. */
  dragged?: [string, string];
}

/**
 * The (i) button's info pane, in the picker's panel to the right of the controls (under them on
 * phones): the details of the camera or lens pointed at, or else the chosen one; or, for a camera
 * setting, graphics of what its ends look like, following the handles as they're dragged.
 */
export function CameraPickerAside({ section, pointed, dragged, ...props }: AsideProps) {
  if (section === "camera" || section === "lens") {
    return <EquipmentAside equipment={section} pointed={pointed} {...props} />;
  }
  return <RangeAside setting={section} dragged={dragged} {...props} />;
}

/** The camera or lens pointed at, or else the chosen one. */
function EquipmentAside({
  equipment,
  pointed,
  photos,
  filters,
}: CameraPickerProps & { equipment: EquipmentKey; pointed?: FilterOption }) {
  const chosen = equipmentChoices(equipment, photos, filters).chosen;
  return <EquipmentInfoPane equipment={equipment} option={pointed ?? chosen} />;
}

/** Graphics of what a setting's ends look like: the handles' while dragged, else the filter's. */
function RangeAside({
  setting,
  dragged,
  filters,
}: CameraPickerProps & { setting: RangeKey; dragged?: [string, string] }) {
  const [low, high] = dragged ?? setEnds(RANGE_VALUES[setting], filters[setting]);
  return (
    <aside aria-label={`About ${RANGE_LABELS[setting]}`}>
      <SettingIllustration setting={setting} low={low} high={high} write={writeSetting(setting)} />
    </aside>
  );
}
