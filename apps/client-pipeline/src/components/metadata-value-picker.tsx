import { useState } from "react";
import type { MetaFieldInfo, MetaGroup, MetaValue } from "@/api/metainfo";
import { FieldLabel } from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { otherGroupNames } from "@/lib/meta-groups";
import { type MetaValueCount, showValue, typedValue, valueKey } from "@/lib/meta-values";

interface MetaValuePickerProps {
  info: MetaFieldInfo;
  /** Every value of the field, with how many photos have it. */
  values: MetaValueCount[];
  /** The group's values. */
  chosen: MetaValue[];
  /** The field's groups, to note which already have each value. */
  groups: MetaGroup[];
  /** The group being edited; undefined for a new one. */
  groupId?: string;
  onChange: (chosen: MetaValue[]) => void;
}

/** values with value in it or out of it. */
function toggled(values: MetaValue[], value: MetaValue, on: boolean): MetaValue[] {
  const others = values.filter((v) => valueKey(v) !== valueKey(value));
  return on ? [...others, value] : others;
}

/** values with more added, each once. */
function withAll(values: MetaValue[], more: MetaValue[]): MetaValue[] {
  const keys = new Set(values.map(valueKey));
  return [...values, ...more.filter((value) => !keys.has(valueKey(value)))];
}

/**
 * The group's values as a checkbox per value the photos have (and any value only groups list), each
 * noting the other groups that already have it, with a way to add one no photo has yet.
 */
export function MetaValuePicker(props: MetaValuePickerProps) {
  const { info, values, chosen, groups, groupId, onChange } = props;
  const keys = new Set(chosen.map(valueKey));
  const extra = chosen.filter(
    (value) => !values.some((v) => valueKey(v.value) === valueKey(value)),
  );
  const shown = [...values, ...extra.map((value) => ({ value, count: 0 }))];
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel
        id="meta-group-values"
        help={`Check each ${info.one} in the group. The list has every ${info.one} the photos have, with how many photos have it and the other groups it's already in; a value can be in more than one group.`}
      >
        Values ({chosen.length} chosen)
      </FieldLabel>
      <div
        role="group"
        aria-labelledby="meta-group-values"
        className="grid max-h-96 grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-4 gap-y-1.5 overflow-y-auto rounded-md border p-3"
      >
        {shown.length === 0 && (
          <p className="text-muted-foreground text-sm">No photo has a {info.one} yet.</p>
        )}
        {shown.map(({ value, count }) => (
          <ValueCheckbox
            key={valueKey(value)}
            label={showValue(info.field, value)}
            count={count}
            checked={keys.has(valueKey(value))}
            others={otherGroupNames(groups, groupId, valueKey(value))}
            onChange={(on) => onChange(toggled(chosen, value, on))}
          />
        ))}
      </div>
      <ValueAdder info={info} onAdd={(value) => onChange(withAll(chosen, [value]))} />
    </div>
  );
}

interface ValueCheckboxProps {
  label: string;
  count: number;
  checked: boolean;
  /** The other groups that already have the value. */
  others: string[];
  onChange: (checked: boolean) => void;
}

function ValueCheckbox({ label, count, checked, others, onChange }: ValueCheckboxProps) {
  return (
    <label className="flex min-w-0 items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary mt-0.5 size-4 shrink-0"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate" title={label}>
            {label}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">{count}</span>
        </span>
        <AlreadyIn names={others} />
      </span>
    </label>
  );
}

/** Notes the other groups a value is already in; it can still be checked here too. */
function AlreadyIn({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <span className="text-xs text-amber-700 dark:text-amber-400">Also in {names.join(", ")}</span>
  );
}

/** Adds a value no photo has yet, typed in. */
function ValueAdder({ info, onAdd }: { info: MetaFieldInfo; onAdd: (value: MetaValue) => void }) {
  const [text, setText] = useState("");
  const value = typedValue(text, info.numeric);
  const add = () => {
    if (value === undefined) return;
    onAdd(value);
    setText("");
  };
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <Input
        aria-label={`Another ${info.one}`}
        placeholder={`Another ${info.one}, as EXIF writes it`}
        className="h-8 max-w-64"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" size="sm" variant="outline" disabled={value === undefined}>
        Add
      </Button>
    </form>
  );
}
