import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { cameraBrand, cameraKind } from "@portfolio/lib/gear-kinds";

/** The key of a heading in a list of choices, such as **DSLR**: a label, not a choice. */
export const HEADING = "heading";

/** The ID of the grouping that lists every camera or lens once, ungrouped. */
const NONE = "none";

/** The heading ID for cameras whose brand or kind isn't known. */
const UNKNOWN = "unknown";

/** What the portfolio calls the camera of photos whose EXIF names none. */
const UNKNOWN_CAMERA = "Unknown camera";

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
const KIND_HEADINGS: [string, string][] = [
  ["mirrorless", "Mirrorless"],
  ["dslr", "DSLR"],
  ["compact", "Compact"],
  ["phone", "Phone"],
  [UNKNOWN, "Unknown"],
];

/** The kind of camera a choice is, or unknown for photos whose EXIF names none. */
function kindOf(name: string): string {
  return name === UNKNOWN_CAMERA ? UNKNOWN : cameraKind(name);
}

/** The brand a camera's model name says it's from, such as Canon, or unknown. */
function brandOf(name: string): string {
  return name === UNKNOWN_CAMERA ? UNKNOWN : (cameraBrand(name) ?? UNKNOWN);
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

/** The cameras under headings, in the headings' order, each camera under the heading `of` names. */
function headed(
  named: FilterOption[],
  headings: [string, string][],
  of: (name: string) => string,
): FilterOption[] {
  return headings.flatMap(([id, label]) => {
    const under = named.filter((option) => of(option.value) === id);
    if (under.length === 0) return [];
    return [heading(label), ...under.map((option) => ({ ...option, depth: 1 }))];
  });
}

/** Every brand the cameras' model names say, A to Z, with Unknown last. */
function brandHeadings(named: FilterOption[]): [string, string][] {
  const brands = new Set(named.map((option) => brandOf(option.value)));
  brands.delete(UNKNOWN);
  const sorted = [...brands].toSorted((a, b) => a.localeCompare(b));
  return [...sorted.map((brand): [string, string] => [brand, brand]), [UNKNOWN, "Unknown"]];
}

/** The cameras' own Brand and Type tabs, guessed from their model names; none for lenses. */
function builtInGroupings(equipment: EquipmentKey, named: FilterOption[]): EquipmentGrouping[] {
  if (equipment !== "camera") return [];
  return [
    { id: "brand", label: "Brand", options: headed(named, brandHeadings(named), brandOf) },
    { id: "type", label: "Type", options: headed(named, KIND_HEADINGS, kindOf) },
  ];
}

/** The metadata groupings, one for each top-level group with groups or names under it. */
function metadataGroupings(equipment: EquipmentKey, options: FilterOption[]): EquipmentGrouping[] {
  const { branches, loose } = branchesOf(equipment, options);
  return branches
    .filter(({ children }) => children.length > 0)
    .map(({ head, children }) => ({
      id: head.value,
      label: head.label.english,
      options: [...children.map((child) => ({ ...child, depth: child.depth - 1 })), ...loose],
    }));
}

/** The ways the picker groups by, in its order. */
const GROUPED_BY = ["Brand", "Type"];

/** The grouping with the label: a metadata group's when there's one, else the cameras' own. */
function groupingNamed(
  label: string,
  metadata: EquipmentGrouping[],
  builtIn: EquipmentGrouping[],
): EquipmentGrouping[] {
  const sameLabel = (grouping: EquipmentGrouping) =>
    grouping.label.toLowerCase() === label.toLowerCase();
  const found = metadata.find(sameLabel) ?? builtIn.find(sameLabel);
  return found ? [found] : [];
}

/**
 * The ways to list the camera or lens choices: **None**, every one once, A to Z; **Brand**; and
 * **Type**. Brand and Type are the top-level metadata groups with those names, their own row left
 * out and what's under it moved up a level, then the cameras or lenses they don't list; for
 * cameras without such a group, they're guessed from the model names, such as Canon and DSLR for
 * "Canon EOS 80D".
 */
export function equipmentGroupings(
  equipment: EquipmentKey,
  options: FilterOption[],
): EquipmentGrouping[] {
  const named = byName(equipment, options);
  const metadata = metadataGroupings(equipment, options);
  const builtIn = builtInGroupings(equipment, named);
  return [
    { id: NONE, label: "None", options: named },
    ...GROUPED_BY.flatMap((label) => groupingNamed(label, metadata, builtIn)),
  ];
}

/** The grouping that lists the chosen group, or None when a camera or lens or nothing is chosen. */
export function groupingOf(
  groupings: EquipmentGrouping[],
  chosen: FilterOption | undefined,
): string {
  const holding = groupings.find(({ options }) =>
    options.some((option) => option.key === chosen?.key && option.value === chosen.value),
  );
  return holding?.id ?? NONE;
}

/** The choices the grouping with the ID lists, or the first grouping's when there's none. */
export function groupingOptions(groupings: EquipmentGrouping[], id: string): FilterOption[] {
  const grouping = groupings.find((each) => each.id === id) ?? groupings[0];
  return grouping?.options ?? [];
}
