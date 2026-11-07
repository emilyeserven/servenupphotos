import { ChevronDown, Eye, EyeOff, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { EquipmentRow } from "@portfolio/components/equipment-row";
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
import { hiddenText } from "@portfolio/components/hidden-note";
import { RangeFilter } from "@portfolio/components/range-filter";
import { SettingIllustration } from "@portfolio/components/setting-graphics";
import { RangePresetList } from "@portfolio/components/range-presets";
import { type EquipmentKey, parseRange, type RangeKey } from "@portfolio/lib/camera-filters";
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
}: PickerPartProps & { section: CameraSection }) {
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{label}</h3>
          <InfoButton on={graphics} label={label} onClick={toggle} />
        </div>
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

/** On wider screens, the (i) button beside the title that shows or hides the info pane. */
function InfoButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? "Hide" : "Show"} info about ${label}`}
      title={`${on ? "Hide" : "Show"} info`}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:hidden",
        on && "bg-accent text-foreground",
      )}
    >
      <Info aria-hidden className="size-4" />
    </button>
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
