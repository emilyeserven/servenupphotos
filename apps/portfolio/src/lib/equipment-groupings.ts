import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";

/**
 * One way the Gear & settings picker can list the cameras or lenses: under one top-level metadata
 * group, such as **Brand** or **Type**, or by name alone.
 */
export interface EquipmentGrouping {
  /** The top-level group's ID, or "name" for by name alone. */
  id: string;
  label: string;
  /** The choices listed this way, in order, each indented under the group it's in. */
  options: FilterOption[];
}

/** A top-level metadata group's choice and the choices under it. */
interface Branch {
  head: FilterOption;
  children: FilterOption[];
}

/** Whether the choice is a top-level metadata group, rather than a camera or lens by name. */
function isTopGroup(equipment: EquipmentKey, option: FilterOption): boolean {
  return option.depth === 0 && option.key === `${equipment}Group`;
}

/**
 * The choices split up: each top-level group with what's under it, and the cameras or lenses no
 * group lists.
 */
function branchesOf(
  equipment: EquipmentKey,
  options: FilterOption[],
): { branches: Branch[]; loose: FilterOption[] } {
  const branches: Branch[] = [];
  const loose: FilterOption[] = [];
  for (const option of options) {
    if (isTopGroup(equipment, option)) branches.push({ head: option, children: [] });
    else if (option.depth === 0) loose.push(option);
    else branches.at(-1)?.children.push(option);
  }
  return { branches, loose };
}

/** Every camera or lens by name, once each, in order, whatever groups list it. */
function byName(equipment: EquipmentKey, options: FilterOption[]): FilterOption[] {
  const names = new Map(
    options
      .filter((option) => option.key === equipment)
      .map((option): [string, FilterOption] => [option.value, { ...option, depth: 0 }]),
  );
  return [...names.values()].toSorted((a, b) => a.value.localeCompare(b.value));
}

/**
 * The ways to list the camera or lens choices: one for each top-level metadata group with groups
 * or names under it, such as **Brand** and **Type**, its own row left out and what's under it moved
 * up a level, then the cameras or lenses no group lists; and last, every one by name.
 */
export function equipmentGroupings(
  equipment: EquipmentKey,
  options: FilterOption[],
): EquipmentGrouping[] {
  const { branches, loose } = branchesOf(equipment, options);
  return [
    ...branches
      .filter(({ children }) => children.length > 0)
      .map(({ head, children }) => ({
        id: head.value,
        label: head.label.english,
        options: [...children.map((child) => ({ ...child, depth: child.depth - 1 })), ...loose],
      })),
    { id: "name", label: "Name", options: byName(equipment, options) },
  ];
}

/** The grouping that lists the chosen choice, or the first when none is chosen. */
export function groupingOf(
  groupings: EquipmentGrouping[],
  chosen: FilterOption | undefined,
): string {
  const holding = groupings.find(({ options }) =>
    options.some((option) => option.key === chosen?.key && option.value === chosen.value),
  );
  return (holding ?? groupings[0])?.id ?? "name";
}

/** The choices the grouping with the ID lists, or the first grouping's when there's none. */
export function groupingOptions(groupings: EquipmentGrouping[], id: string): FilterOption[] {
  const grouping = groupings.find((each) => each.id === id) ?? groupings[0];
  return grouping?.options ?? [];
}
