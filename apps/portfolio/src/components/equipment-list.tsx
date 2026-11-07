import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import type { CameraPickerProps } from "@portfolio/components/camera-picker";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { EquipmentRow } from "@portfolio/components/equipment-row";
import { hiddenText } from "@portfolio/components/hidden-note";
import { blockersOf, cameraBlockers } from "@portfolio/lib/camera-blockers";
import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import { equipmentChoices, equipmentFilters, isChosen } from "@portfolio/lib/camera-picker";
import {
  equipmentGroupings,
  groupingOf,
  groupingOptions,
  HEADING,
} from "@portfolio/lib/equipment-groupings";
import { type EquipmentSort, sortEquipment } from "@portfolio/lib/equipment-sort";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { cn } from "@portfolio/lib/utils";

/** What each equipment list calls all of its choices. */
const ANY_LABELS: Record<EquipmentKey, string> = { camera: "All cameras", lens: "All lenses" };

/** The Cameras list's orders, with their names; the Lenses list has none. */
const SORTS: Record<EquipmentKey, [EquipmentSort, string][]> = {
  camera: [
    ["name", "Name"],
    ["oldest", "Oldest first"],
    ["newest", "Newest first"],
  ],
  lens: [],
};

/** Whether the choice is a heading, such as **DSLR**, rather than something to pick. */
function isHeading(option: FilterOption): boolean {
  return option.key === HEADING;
}

/** The choices with each heading left out when nothing is listed under it. */
function withoutEmptyHeadings(options: FilterOption[]): FilterOption[] {
  return options.filter((option, index) => !isHeading(option) || options[index + 1]?.depth === 1);
}

interface ListProps extends CameraPickerProps {
  equipment: EquipmentKey;
  onPoint: (option: FilterOption | undefined) => void;
}

/**
 * The camera or lens choices, each telling `onPoint` when it's pointed at: a Group by dropdown
 * with each way to list them, a Sort dropdown for the cameras (by name, or by when the first photo
 * was taken with each, oldest or newest first), All cameras or All lenses, then the choices.
 */
export function EquipmentList(props: ListProps) {
  const { equipment, photos, filters } = props;
  const choices = equipmentChoices(equipment, photos, filters);
  const groupings = equipmentGroupings(equipment, choices.options);
  const [groupingId, setGroupingId] = useState(() => groupingOf(groupings, choices.chosen));
  const [sort, setSort] = useState<EquipmentSort>("name");
  const options = sortEquipment(equipment, groupingOptions(groupings, groupingId), sort);
  const choose = (option?: FilterOption) => props.onChange(equipmentFilters(equipment, option));
  return (
    <div className="flex flex-col" onMouseLeave={() => props.onPoint(undefined)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <PickSelect
          label="Group by"
          options={groupings.map(({ id, label }): [string, string] => [id, label])}
          value={groupingId}
          onChange={setGroupingId}
        />
        <PickSelect label="Sort" options={SORTS[equipment]} value={sort} onChange={setSort} />
      </div>
      <ChoiceRow label={ANY_LABELS[equipment]} on={!choices.chosen} onClick={() => choose()} />
      <Choices {...props} options={options} choose={choose} />
    </div>
  );
}

/** The choices the other filters leave, or all of them dimmed, and the button that switches. */
function Choices({
  options,
  choose,
  ...props
}: ListProps & { options: FilterOption[]; choose: (option?: FilterOption) => void }) {
  const { equipment, filters, source, onPoint } = props;
  const [showHidden, setShowHidden] = useState(false);
  const isOn = (option: FilterOption) => isChosen(option, filters);
  const hides = (option: FilterOption) => option.count === 0 && !isOn(option) && !isHeading(option);
  const shown = withoutEmptyHeadings(options.filter((option) => showHidden || !hides(option)));
  const blockers = useMemo(() => (showHidden ? cameraBlockers(source) : []), [showHidden, source]);
  return (
    <>
      {shown.map((option, index) =>
        isHeading(option) ? (
          <Heading key={`${index}-${option.value}`} label={option.value} />
        ) : (
          <EquipmentRow
            key={`${index}-${option.key}:${option.value}`}
            option={option}
            on={isOn(option)}
            blockedBy={
              option.count === 0 ? blockersOf(equipment, option, filters, blockers) : undefined
            }
            onClick={(on) => choose(on ? undefined : option)}
            onPoint={() => onPoint(option)}
          />
        ),
      )}
      <HiddenToggle
        count={options.filter(hides).length}
        shown={showHidden}
        onClick={() => setShowHidden(!showHidden)}
      />
    </>
  );
}

/** A heading over the choices under it, such as **DSLR**. */
function Heading({ label }: { label: string }) {
  return <span className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{label}</span>;
}

/** A small labeled dropdown, such as Group by's None, Brand and Type; none with fewer than two choices. */
function PickSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  if (options.length < 2) return null;
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(SELECT_CLASS, "h-7 min-w-0 text-xs")}
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
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
