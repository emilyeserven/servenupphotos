import { Check } from "lucide-react";
import type { CameraPickerProps, CameraSection } from "@portfolio/components/camera-picker";
import {
  RANGE_LABELS,
  RANGE_PRESETS,
  RANGE_VALUES,
  writeSetting,
} from "@portfolio/components/camera-ranges";
import { HiddenNote } from "@portfolio/components/hidden-note";
import { RangeFilter } from "@portfolio/components/range-filter";
import { RangePresetList } from "@portfolio/components/range-presets";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import type { EquipmentKey, RangeKey } from "@portfolio/lib/camera-filters";
import { equipmentChoices, equipmentFilters, isChosen } from "@portfolio/lib/camera-picker";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { cn } from "@portfolio/lib/utils";

/** The right side of the Camera picker: the chosen section's choices. */
export function CameraPickerPart({
  section,
  ...props
}: CameraPickerProps & { section: CameraSection }) {
  if (section === "camera" || section === "lens") {
    return <EquipmentPart key={section} equipment={section} {...props} />;
  }
  return <RangePart key={section} setting={section} {...props} />;
}

/** What each equipment list calls all of its choices. */
const ANY_LABELS: Record<EquipmentKey, string> = { camera: "All cameras", lens: "All lenses" };

/**
 * Every camera or lens group and name, indented under the group it's in, with how many photos
 * each would show; clicking the chosen one again goes back to all. Choices that would show no
 * photos, given the other filters, are left out, unless chosen.
 */
function EquipmentPart({
  equipment,
  photos,
  filters,
  onChange,
}: CameraPickerProps & { equipment: EquipmentKey }) {
  const { options, chosen } = equipmentChoices(equipment, photos, filters);
  const shown = options.filter((option) => option.count > 0 || option === chosen);
  const choose = (option?: FilterOption) => onChange(equipmentFilters(equipment, option));
  return (
    <div className="flex flex-col">
      <ChoiceRow label={ANY_LABELS[equipment]} on={!chosen} onClick={() => choose()} />
      {shown.map((option, index) => (
        <EquipmentRow
          key={`${index}-${option.key}:${option.value}`}
          option={option}
          on={isChosen(option, filters)}
          onClick={(on) => choose(on ? undefined : option)}
        />
      ))}
      <HiddenNote count={options.length - shown.length} noun="choices" />
    </div>
  );
}

/** One camera or lens choice, in the Script Display's writing. */
function EquipmentRow({
  option,
  on,
  onClick,
}: {
  option: FilterOption;
  on: boolean;
  onClick: (on: boolean) => void;
}) {
  const { script } = useScriptDisplay();
  return (
    <ChoiceRow
      label={option.label[script]}
      count={option.count}
      depth={option.depth}
      on={on}
      onClick={() => onClick(on)}
    />
  );
}

/** A row in a list of choices: a check while it's on, its name, and how many photos it would show. */
function ChoiceRow({
  label,
  count,
  depth = 0,
  on,
  onClick,
}: {
  label: string;
  count?: number;
  depth?: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ paddingLeft: `${0.5 + depth}rem` }}
      className={cn(
        "flex items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
        on && "font-medium",
      )}
    >
      <Check aria-hidden className={cn("size-4 shrink-0", !on && "invisible")} />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

/** A camera setting's slider, with its quick picks listed under it. */
function RangePart({ setting, filters, onChange }: CameraPickerProps & { setting: RangeKey }) {
  const label = RANGE_LABELS[setting];
  const set = (range: string | undefined) => onChange({ [setting]: range });
  return (
    <div className="flex flex-col gap-3">
      <RangeFilter
        label={label}
        values={RANGE_VALUES[setting]}
        range={filters[setting]}
        write={writeSetting(setting)}
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
