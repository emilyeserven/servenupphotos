import type { MetaFieldInfo, MetaGroup } from "@/api/metainfo";
import { FieldLabel } from "@/components/field-label";
import { groupTree, withDescendants } from "@/lib/meta-groups";

interface MetaParentFieldProps {
  info: MetaFieldInfo;
  /** The field's groups. */
  groups: MetaGroup[];
  /** The group being edited; undefined for a new one. */
  groupId?: string;
  /** The chosen parent's ID, or "" for none. */
  parent: string;
  onChange: (parent: string) => void;
}

/**
 * Which group of the same field this one is in, such as "Canon" for "Canon kit lenses". It doesn't
 * offer the group itself or any group in it, so no group ends up in itself.
 */
export function MetaParentField({ info, groups, groupId, parent, onChange }: MetaParentFieldProps) {
  const inside = groupId ? withDescendants(groups, groupId) : new Set<string>();
  const rows = groupTree(groups).filter((row) => !inside.has(row.group.id));
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel
        htmlFor="meta-group-parent"
        help={`The ${info.one} group this one is part of, such as “Canon lenses” for “Canon kit lenses”. A group covers its own values and those of every group in it.`}
      >
        In
      </FieldLabel>
      <select
        id="meta-group-parent"
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        value={parent}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not in another group</option>
        {rows.map(({ group, depth }) => (
          <option key={group.id} value={group.id}>
            {"  ".repeat(depth)}
            {group.name}
          </option>
        ))}
      </select>
    </div>
  );
}
