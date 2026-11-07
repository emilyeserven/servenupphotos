import { Check, Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useMemo, useState } from "react";
import type { CameraPickerProps, CameraSection } from "@portfolio/components/camera-picker";
import {
  RANGE_LABELS,
  RANGE_PRESETS,
  RANGE_VALUES,
  writeSetting,
} from "@portfolio/components/camera-ranges";
import { hiddenText } from "@portfolio/components/hidden-note";
import { Tooltip, TooltipContent, TooltipTrigger } from "@portfolio/components/ui/tooltip";
import { RangeFilter } from "@portfolio/components/range-filter";
import { RangePresetList } from "@portfolio/components/range-presets";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import type { EquipmentKey, RangeKey } from "@portfolio/lib/camera-filters";
import { blockersOf, cameraBlockers } from "@portfolio/lib/camera-blockers";
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
  const { options, chosen } = equipmentChoices(equipment, photos, filters);
  const shown = options.filter((option) => showHidden || option.count > 0 || option === chosen);
  const hidden = options.filter((option) => option.count === 0 && option !== chosen).length;
  const blockers = useMemo(() => (showHidden ? cameraBlockers(source) : []), [showHidden, source]);
  const choose = (option?: FilterOption) => onChange(equipmentFilters(equipment, option));
  return (
    <div className="flex flex-col">
      <ChoiceRow label={ANY_LABELS[equipment]} on={!chosen} onClick={() => choose()} />
      {shown.map((option, index) => (
        <EquipmentRow
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

/** What a hidden choice's hover says hides it, such as "Hidden by Aperture or Lens". */
function blockedText(blockedBy: string[]): string {
  if (blockedBy.length === 0) return "Hidden by the other filters together";
  return `Hidden by ${new Intl.ListFormat("en", { type: "disjunction" }).format(blockedBy)}`;
}

/**
 * One camera or lens choice, in the Script Display's writing. `blockedBy` names the filters hiding
 * it, when it's a hidden one: it's dimmed and says so on hover.
 */
function EquipmentRow({
  option,
  on,
  blockedBy,
  onClick,
}: {
  option: FilterOption;
  on: boolean;
  blockedBy?: string[];
  onClick: (on: boolean) => void;
}) {
  const { script } = useScriptDisplay();
  const row = (
    <ChoiceRow
      label={option.label[script]}
      count={option.count}
      depth={option.depth}
      on={on}
      dimmed={blockedBy !== undefined}
      onClick={() => onClick(on)}
    />
  );
  if (!blockedBy) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">{blockedText(blockedBy)}</TooltipContent>
    </Tooltip>
  );
}

/** A row in a list of choices: a check while it's on, its name, and how many photos it would show. */
function ChoiceRow({
  label,
  count,
  depth = 0,
  on,
  dimmed = false,
  onClick,
  ...rest
}: Omit<ComponentProps<"button">, "onClick"> & {
  label: string;
  count?: number;
  depth?: number;
  on: boolean;
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ paddingLeft: `${0.5 + depth}rem` }}
      className={cn(
        "flex items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
        on && "font-medium",
        dimmed && "text-muted-foreground/70",
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
