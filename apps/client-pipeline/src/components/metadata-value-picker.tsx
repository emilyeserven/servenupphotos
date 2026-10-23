import { useState } from "react";
import type { MetaFieldInfo, MetaValue } from "@/api/metainfo";
import { FieldLabel } from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type MetaValueCount,
  showValue,
  typedValue,
  valueKey,
  valuesBetween,
} from "@/lib/meta-values";

interface MetaValuePickerProps {
  info: MetaFieldInfo;
  /** Every value of the field, with how many photos have it. */
  values: MetaValueCount[];
  /** The group's values. */
  chosen: MetaValue[];
  onChange: (chosen: MetaValue[]) => void;
}

/** Narrow columns for numbers, and wide ones for camera and lens names. */
function columns(numeric: boolean): string {
  return numeric
    ? "grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]"
    : "grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]";
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
 * The group's values as a checkbox per value the photos have (and any value only groups list), with
 * a way to add one no photo has yet and, for numbers, to check a range.
 */
export function MetaValuePicker({ info, values, chosen, onChange }: MetaValuePickerProps) {
  const keys = new Set(chosen.map(valueKey));
  const extra = chosen.filter(
    (value) => !values.some((v) => valueKey(v.value) === valueKey(value)),
  );
  const shown = [...values, ...extra.map((value) => ({ value, count: 0 }))];
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel
        id="meta-group-values"
        help={`Check each ${info.one} in the group. The list has every ${info.one} the photos have, with how many photos have it.`}
      >
        Values ({chosen.length} chosen)
      </FieldLabel>
      <div
        role="group"
        aria-labelledby="meta-group-values"
        className={cn(
          "grid max-h-80 gap-x-4 gap-y-1 overflow-y-auto rounded-md border p-3",
          columns(info.numeric),
        )}
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
            onChange={(on) => onChange(toggled(chosen, value, on))}
          />
        ))}
      </div>
      {info.numeric && (
        <RangeAdder
          info={info}
          onAdd={(from, to) => onChange(withAll(chosen, valuesBetween(values, from, to)))}
        />
      )}
      <ValueAdder info={info} onAdd={(value) => onChange(withAll(chosen, [value]))} />
    </div>
  );
}

interface ValueCheckboxProps {
  label: string;
  count: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ValueCheckbox({ label, count, checked, onChange }: ValueCheckboxProps) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4 shrink-0"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">{count}</span>
    </label>
  );
}

/** Checks every value the photos have from one number to another, such as focal lengths 10 to 24. */
function RangeAdder({
  info,
  onAdd,
}: {
  info: MetaFieldInfo;
  onAdd: (from: number, to: number) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const ready = from.trim() !== "" && to.trim() !== "";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Check every {info.one} from</span>
      <Input
        aria-label="From"
        inputMode="decimal"
        className="h-8 w-20"
        value={from}
        onChange={(event) => setFrom(event.target.value)}
      />
      <span>to</span>
      <Input
        aria-label="To"
        inputMode="decimal"
        className="h-8 w-20"
        value={to}
        onChange={(event) => setTo(event.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={!ready}
        onClick={() => onAdd(Number(from), Number(to))}
      >
        Check
      </Button>
    </div>
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
