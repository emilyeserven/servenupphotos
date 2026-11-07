import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { type CameraKind, cameraKind } from "@portfolio/lib/gear-kinds";

/** The key of a heading in a list of choices, such as **DSLR**: a label, not a choice. */
export const HEADING = "heading";

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

/** Each kind of camera's heading, in the order the Type tab lists them. */
const KIND_HEADINGS: [CameraKind | "unknown", string][] = [
  ["mirrorless", "Mirrorless"],
  ["dslr", "DSLR"],
  ["compact", "Compact"],
  ["phone", "Phone"],
  ["unknown", "Unknown"],
];

/** What the portfolio calls the camera of photos whose EXIF names none. */
const UNKNOWN_CAMERA = "Unknown camera";

/** The kind of camera a choice is, or unknown for photos whose EXIF names none. */
function kindOf(name: string): CameraKind | "unknown" {
  return name === UNKNOWN_CAMERA ? "unknown" : cameraKind(name);
}

/** A heading row for the label, such as **DSLR**. */
function heading(label: string): FilterOption {
  return {
    key: HEADING,
    value: label,
    label: { english: label, romanized: label, phonetic: label, native: label },
    depth: 0,
    count: 0,
  };
}

/**
 * The cameras by the kind their model name says they are, each kind under its heading, such as
 * **DSLR** for "Canon EOS 80D".
 */
function typeOptions(named: FilterOption[]): FilterOption[] {
  return KIND_HEADINGS.flatMap(([kind, label]) => {
    const ofKind = named.filter((option) => kindOf(option.value) === kind);
    if (ofKind.length === 0) return [];
    return [heading(label), ...ofKind.map((option) => ({ ...option, depth: 1 }))];
  });
}

/**
 * The cameras' own Type tab, by the kind of camera each is, unless a metadata group already makes
 * a tab called Type; none for lenses.
 */
function typeGrouping(
  equipment: EquipmentKey,
  named: FilterOption[],
  others: EquipmentGrouping[],
): EquipmentGrouping[] {
  if (equipment !== "camera" || others.some(({ label }) => label === "Type")) return [];
  return [{ id: "type", label: "Type", options: typeOptions(named) }];
}

/**
 * The ways to list the camera or lens choices: one for each top-level metadata group with groups
 * or names under it, such as **Brand** and **Type**, its own row left out and what's under it moved
 * up a level, then the cameras or lenses no group lists; for cameras, by the kind each is; and
 * last, every one by name.
 */
export function equipmentGroupings(
  equipment: EquipmentKey,
  options: FilterOption[],
): EquipmentGrouping[] {
  const { branches, loose } = branchesOf(equipment, options);
  const named = byName(equipment, options);
  const groups = branches
    .filter(({ children }) => children.length > 0)
    .map(({ head, children }) => ({
      id: head.value,
      label: head.label.english,
      options: [...children.map((child) => ({ ...child, depth: child.depth - 1 })), ...loose],
    }));
  return [
    ...groups,
    ...typeGrouping(equipment, named, groups),
    { id: "name", label: "Name", options: named },
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
