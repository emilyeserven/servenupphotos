import type { LocationOption } from "@portfolio/lib/filter-options";
import type { ScriptDisplay } from "@portfolio/lib/localize";

/** A choice's value as the Places filter keeps it: its key and value, such as "city:Seoul". */
export function valueOf(option: LocationOption): string {
  return `${option.key}:${option.value}`;
}

/** Every choice in the tree, each before what's in it. */
export function everyOption(options: LocationOption[]): LocationOption[] {
  return options.flatMap((option) => [option, ...everyOption(option.children)]);
}

/**
 * The choices that would show any photos, given the other filters, each with what's in it that
 * would; a chosen one, or one with a chosen one inside, stays so it can be unchosen.
 */
export function withPhotos(options: LocationOption[], selected: string[]): LocationOption[] {
  return options.flatMap((option) => {
    const children = withPhotos(option.children, selected);
    const keep = option.count > 0 || selected.includes(valueOf(option)) || children.length > 0;
    return keep ? [{ ...option, children }] : [];
  });
}

/** A choice found by a search, with the names of the choices it's in, outermost first. */
export interface PlaceMatch {
  option: LocationOption;
  path: string[];
}

/** Whether the choice's name, written the way it's shown or in English, has the search in it. */
function nameHas(option: LocationOption, query: string, script: ScriptDisplay): boolean {
  const names = [option.label[script], option.label.english];
  return names.some((name) => name.toLowerCase().includes(query));
}

/** Every choice whose name has the search in it, in the tree's order, each with what it's in. */
export function placeMatches(
  options: LocationOption[],
  query: string,
  script: ScriptDisplay,
  path: string[] = [],
): PlaceMatch[] {
  return options.flatMap((option) => {
    const inside = placeMatches(option.children, query, script, [...path, option.label[script]]);
    return nameHas(option, query, script) ? [{ option, path }, ...inside] : inside;
  });
}

/**
 * The IDs of the choices to open as columns when the picker opens: the ones around the first
 * chosen place, outermost first, or the only country when there's just one.
 */
export function startColumns(options: LocationOption[], selected: string[]): string[] {
  const [first] = selected;
  if (first === undefined) return options.length === 1 ? [options[0]!.id] : [];
  return everyOption(options)
    .filter((option) => everyOption(option.children).some((inside) => valueOf(inside) === first))
    .map((option) => option.id);
}

/** What a column of the choices is headed: Countries, Regions, Cities or Places. */
export function columnName(options: LocationOption[]): string {
  return COLUMN_NAMES[options[0]?.key ?? "place"];
}

const COLUMN_NAMES: Record<LocationOption["key"], string> = {
  country: "Countries",
  state: "Regions",
  city: "Cities",
  place: "Places",
};
