import { ArrowUpDown, Eye, EyeOff, ListTree, type LucideIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { CameraPickerProps } from "@portfolio/components/camera-picker";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { EquipmentRow } from "@portfolio/components/equipment-row";
import { hiddenText } from "@portfolio/components/hidden-note";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
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
import { cn } from "@portfolio/lib/utils";

/** What each equipment list calls all of its choices. */
const ANY_LABELS: Record<EquipmentKey, string> = { camera: "All cameras", lens: "All lenses" };

/** The orders the Cameras and Lenses lists can be in, with their names. */
const SORTS: [EquipmentSort, string][] = [
  ["name", "Name"],
  ["oldest", "Oldest first"],
  ["newest", "Newest first"],
];

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
  /** The list's title row, given the Group by and Sort buttons to put in it. */
  header: (controls: ReactNode) => ReactNode;
  onPoint: (option: FilterOption | undefined) => void;
}

/**
 * The camera or lens choices, each telling `onPoint` when it's pointed at, under `header` given a
 * Group by menu with each way to list them and a Sort menu (by name, or by when the first photo was
 * taken with each, oldest or newest first), All cameras or All lenses, then the choices.
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
    <div className="flex flex-col gap-2" onMouseLeave={() => props.onPoint(undefined)}>
      <div className="flex flex-col">
        {props.header(
          <>
            <PickMenu
              label="Group by"
              Icon={ListTree}
              options={groupings.map(({ id, label }): [string, string] => [id, label])}
              value={groupingId}
              onChange={setGroupingId}
            />
            <PickMenu
              label="Sort"
              Icon={ArrowUpDown}
              options={SORTS}
              value={sort}
              onChange={setSort}
            />
          </>,
        )}
        <ChoiceRow label={ANY_LABELS[equipment]} on={!choices.chosen} onClick={() => choose()} />
        <Choices {...props} options={options} choose={choose} />
      </div>
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

/** The name of the choice with the ID. */
function nameOf<T extends string>(options: [T, string][], value: T): string {
  return options.find(([id]) => id === value)?.[1] ?? "";
}

/** Whether the value isn't the first choice, the default. */
function isChanged<T extends string>(options: [T, string][], value: T): boolean {
  return options.findIndex(([id]) => id === value) > 0;
}

/**
 * A small button naming what it changes, such as **Group by**, with its icon, that opens a menu of
 * its choices, the current one checked; pressed-looking while it isn't the first, the default.
 * None with fewer than two choices.
 */
function PickMenu<T extends string>({
  label,
  Icon,
  options,
  value,
  onChange,
}: {
  label: string;
  Icon: LucideIcon;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;
  const current = nameOf(options, value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${label}: ${current}`}
          title={`${label}: ${current}`}
          className={cn(
            "h-7 gap-1 px-2 text-xs font-normal text-muted-foreground",
            isChanged(options, value) && "bg-accent text-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-44 flex-col p-1">
        {options.map(([id, name]) => (
          <ChoiceRow
            key={id}
            label={name}
            on={id === value}
            onClick={() => {
              onChange(id);
              setOpen(false);
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
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
