import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { EquipmentRow } from "@portfolio/components/equipment-row";
import type { CameraPickerProps, CameraSection } from "@portfolio/components/camera-picker";
import {
  RANGE_LABELS,
  RANGE_PRESETS,
  RANGE_VALUES,
  writeSetting,
} from "@portfolio/components/camera-ranges";
import { hiddenText } from "@portfolio/components/hidden-note";
import { RangeFilter } from "@portfolio/components/range-filter";
import { SettingIllustration } from "@portfolio/components/setting-graphics";
import { RangePresetList } from "@portfolio/components/range-presets";
import type { EquipmentKey, RangeKey } from "@portfolio/lib/camera-filters";
import { blockersOf, cameraBlockers } from "@portfolio/lib/camera-blockers";
import { equipmentChoices, equipmentFilters, isChosen } from "@portfolio/lib/camera-picker";
import {
  type EquipmentGrouping,
  equipmentGroupings,
  groupingOf,
  groupingOptions,
} from "@portfolio/lib/equipment-groupings";
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
 * photos, given the other filters, are left out, unless chosen, behind a button that shows them
 * dimmed, each saying on hover which filters hide it.
 */
function EquipmentPart({
  equipment,
  photos,
  filters,
  source,
  onChange,
}: CameraPickerProps & { equipment: EquipmentKey }) {
  const [showHidden, setShowHidden] = useState(false);
  const choices = equipmentChoices(equipment, photos, filters);
  const { chosen } = choices;
  const groupings = equipmentGroupings(equipment, choices.options);
  const [groupingId, setGroupingId] = useState(() => groupingOf(groupings, chosen));
  const options = groupingOptions(groupings, groupingId);
  const isOn = (option: FilterOption) => isChosen(option, filters);
  const shown = options.filter((option) => showHidden || option.count > 0 || isOn(option));
  const hidden = options.filter((option) => option.count === 0 && !isOn(option)).length;
  const blockers = useMemo(() => (showHidden ? cameraBlockers(source) : []), [showHidden, source]);
  const choose = (option?: FilterOption) => onChange(equipmentFilters(equipment, option));
  return (
    <div className="flex flex-col">
      <GroupingTabs groupings={groupings} value={groupingId} onChange={setGroupingId} />
      <ChoiceRow label={ANY_LABELS[equipment]} on={!chosen} onClick={() => choose()} />
      {shown.map((option, index) => (
        <EquipmentRow
          equipment={equipment}
          key={`${index}-${option.key}:${option.value}`}
          option={option}
          on={isChosen(option, filters)}
          blockedBy={
            option.count === 0 ? blockersOf(equipment, option, filters, blockers) : undefined
          }
          onClick={(on) => choose(on ? undefined : option)}
        />
      ))}
      <HiddenToggle count={hidden} shown={showHidden} onClick={() => setShowHidden(!showHidden)} />
    </div>
  );
}

/** Tabs for each way to list the cameras or lenses, such as Brand, Type or Name; none with one way. */
function GroupingTabs({
  groupings,
  value,
  onChange,
}: {
  groupings: EquipmentGrouping[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (groupings.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label="Group by"
      className="mb-2 flex items-center gap-1 rounded-md border bg-muted/50 p-0.5"
    >
      <span className="px-1.5 text-xs text-muted-foreground">Group by</span>
      {groupings.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex-1 rounded-sm px-1.5 py-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === id && "bg-background text-foreground shadow-xs",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The button that shows or hides the choices the other filters hide; nothing when none are. */
function HiddenToggle({
  count,
  shown,
  onClick,
}: {
  count: number;
  shown: boolean;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      aria-pressed={shown}
      onClick={onClick}
      className="mt-1 flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
    >
      {shown ? (
        <EyeOff aria-hidden className="size-3.5" />
      ) : (
        <Eye aria-hidden className="size-3.5" />
      )}
      {shown ? `Hide the ${count} hidden choices` : `Show ${hiddenText(count, "choices")}`}
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
        illustrate={(low, high) => (
          <SettingIllustration
            setting={setting}
            low={low}
            high={high}
            write={writeSetting(setting)}
          />
        )}
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
