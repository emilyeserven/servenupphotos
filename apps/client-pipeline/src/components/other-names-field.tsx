import { FieldLabel } from "@/components/field-label";
import type { RegionListData } from "@/components/region-list";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { RegionNode } from "@/lib/region-tree";

/** How to fill in Other names, shown beside its title. */
const HELP =
  "Other ways photos and places write it, such as “United States” for “United States of America”. This name wins: the list counts them as it, and Update Data → Location names rewrites them to it in the photo and place files.";

/** The count with its noun, such as "1 photo" or "3 photos". */
function photosText(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

/**
 * The other countries or cities in the list that can be another name of node: not itself, and
 * not one with other names of its own.
 */
function candidates(node: RegionNode, list: RegionListData): ComboboxOption[] {
  const hasOwn = (n: RegionNode) => (list.localizations.get(n.key)?.otherNames ?? []).length > 0;
  return list.nodes
    .filter((n) => n.kind === node.kind && n.key !== node.key && !hasOwn(n))
    .map((n) => ({ value: n.name, label: n.name, detail: photosText(n.photos) }));
}

/** The options, plus each chosen name that isn't one, so it doesn't show as unknown. */
function withChosen(options: ComboboxOption[], value: string[]): ComboboxOption[] {
  const extra = value.filter((name) => !options.some((o) => o.value === name));
  return [...options, ...extra.map((name) => ({ value: name, label: name }))];
}

interface OtherNamesFieldProps {
  node: RegionNode;
  list: RegionListData;
  value: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}

/** A country's or city's other names, picked from the list's other countries or cities, or typed. */
export function OtherNamesField({ node, list, value, disabled, onChange }: OtherNamesFieldProps) {
  const id = `${node.kind}-other-names`;
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id={`${id}-label`} help={HELP}>
        Other names
      </FieldLabel>
      <Combobox
        id={id}
        multiple
        aria-labelledby={`${id}-label`}
        options={withChosen(candidates(node, list), value)}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={`Another way to write ${node.name}`}
        emptyText="Type a name to add it."
        createLabel={(text) => `Add “${text}” as another name`}
        onCreate={(text) => onChange([...value, text.trim()])}
      />
    </div>
  );
}
