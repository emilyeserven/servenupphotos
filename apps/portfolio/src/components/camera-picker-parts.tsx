import { ChevronDown, Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EquipmentInfoPane } from "@portfolio/components/equipment-info-pane";
import { EquipmentList } from "@portfolio/components/equipment-list";
import { InfoButton } from "@portfolio/components/info-button";
import type { CameraSection, PickerPartProps } from "@portfolio/components/camera-picker";
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
import { cn } from "@portfolio/lib/utils";

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
 * dimmed, each saying on hover which filters hide it. While `graphics` is on, the (i) button's
 * pane to the right shows the details of the camera or lens pointed at, or else the chosen one.
 */
function EquipmentPart({
  equipment,
  graphics,
  onGraphics,
  ...props
}: PickerPartProps & { equipment: EquipmentKey }) {
  const [pointed, setPointed] = useState<FilterOption | undefined>();
  const chosen = equipmentChoices(equipment, props.photos, props.filters).chosen;
  const toggle = () => onGraphics(!graphics);
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <EquipmentList
          equipment={equipment}
          onPoint={setPointed}
          header={(controls) => (
            <PartTitle label={TITLES[equipment]} on={graphics} onClick={toggle}>
              {controls}
            </PartTitle>
          )}
          {...props}
        />
        <MobileInfoToggle on={graphics} onClick={toggle} />
      </div>
      {graphics && <EquipmentInfoPane equipment={equipment} option={pointed ?? chosen} />}
    </div>
  );
}

/** A section's title, with `children` (such as Group by and Sort) and the (i) button to its right, the (i) on wider screens only. */
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
      <span className="max-sm:hidden">
        <InfoButton open={on} label={`info about ${label}`} onClick={onClick} />
      </span>
    </div>
  );
}

/** The ends of the range the filters set, or every value's when they set none. */
function setEnds(values: string[], range: string | undefined): [string, string] {
  return parseRange(range) ?? [values[0] ?? "", values.at(-1) ?? ""];
}

/**
 * A camera setting's slider, with its quick picks listed under it and, while `graphics` is on, a
 * pane to the right with graphics of what its ends look like, following the handles as they move.
 */
function RangePart({
  setting,
  filters,
  graphics,
  onGraphics,
  onChange,
}: PickerPartProps & { setting: RangeKey }) {
  const label = RANGE_LABELS[setting];
  const set = (range: string | undefined) => onChange({ [setting]: range });
  const [dragged, setDragged] = useState<[string, string] | undefined>();
  const [low, high] = dragged ?? setEnds(RANGE_VALUES[setting], filters[setting]);
  const toggle = () => onGraphics(!graphics);
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <PartTitle label={label} on={graphics} onClick={toggle} />
        <RangeFilter
          label={label}
          values={RANGE_VALUES[setting]}
          range={filters[setting]}
          write={writeSetting(setting)}
          onDrag={setDragged}
          onChange={set}
        />
        <RangePresetList
          label={label}
          presets={RANGE_PRESETS[setting]}
          range={filters[setting]}
          onChange={set}
        />
        <MobileInfoToggle on={graphics} onClick={toggle} />
      </div>
      {graphics && (
        <aside
          aria-label={`About ${label}`}
          className="flex shrink-0 flex-col sm:w-44 sm:border-l sm:pl-3"
        >
          <SettingIllustration
            setting={setting}
            low={low}
            high={high}
            write={writeSetting(setting)}
          />
        </aside>
      )}
    </div>
  );
}

/** On phones, a full-width button at the bottom that opens or closes the info under it. */
function MobileInfoToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={on}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border py-2 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:hidden"
    >
      <Info aria-hidden className="size-4" />
      {on ? "Hide info" : "Show info"}
      <ChevronDown aria-hidden className={cn("size-4 transition-transform", on && "rotate-180")} />
    </button>
  );
}
