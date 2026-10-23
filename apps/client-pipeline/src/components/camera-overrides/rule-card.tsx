import { PlusIcon, XIcon } from "lucide-react";
import {
  fieldLabel,
  OVERRIDE_FIELDS,
  type OverrideField,
  type OverrideRule,
  type OverrideValue,
} from "@/api/cameras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exifValueCounts } from "@/lib/camera-overrides";
import { canonicalJson } from "@/lib/combined";
import type { CombinedPhoto } from "@/lib/group-photos";

const selectClass = "border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm";

interface RuleCardProps {
  index: number;
  rule: OverrideRule;
  /** The camera's photos, whose EXIF values a rule can be limited to. */
  photos: CombinedPhoto[];
  /** With the changed rule, or null to remove it. */
  onChange: (rule: OverrideRule | null) => void;
}

/** One rule: which of the camera's photos it's for, and the fields it sets on them. */
export function RuleCard({ index, rule, photos, onChange }: RuleCardProps) {
  return (
    <section aria-label={`Rule ${index + 1}`} className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Rule {index + 1}</h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove rule ${index + 1}`}
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      </div>
      <WhenField rule={rule} photos={photos} onChange={onChange} />
      <SetFields rule={rule} onChange={onChange} />
    </section>
  );
}

type RuleProps = Pick<RuleCardProps, "rule" | "onChange">;

/** "For every photo", or for the photos whose EXIF has one value of a field. */
function WhenField({ rule, photos, onChange }: RuleProps & { photos: CombinedPhoto[] }) {
  const field = rule.when?.field ?? "";
  const chooseField = (f: string) => {
    const values = exifValueCounts(photos, f as OverrideField);
    onChange({
      ...rule,
      when: f ? { field: f as OverrideField, value: values[0]?.value ?? null } : null,
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>For</span>
      <select
        aria-label="Which photos"
        className={selectClass}
        value={field}
        onChange={(e) => chooseField(e.target.value)}
      >
        <option value="">every photo from this camera</option>
        {OVERRIDE_FIELDS.filter((f) => f.field !== "camera").map((f) => (
          <option key={f.field} value={f.field}>
            photos whose EXIF {f.label.toLowerCase()} is
          </option>
        ))}
      </select>
      {rule.when && <WhenValue rule={rule} photos={photos} onChange={onChange} />}
    </div>
  );
}

/** How a value shows in a list: "(none)" for null. */
export function showValue(value: unknown): string {
  return value === null || value === undefined ? "(none)" : String(value);
}

/** The value a rule is limited to, from those the camera's photos have. */
function WhenValue({ rule, photos, onChange }: RuleProps & { photos: CombinedPhoto[] }) {
  const when = rule.when!;
  const counts = exifValueCounts(photos, when.field);
  const known = counts.some((c) => canonicalJson(c.value) === canonicalJson(when.value));
  const options = known ? counts : [{ value: when.value, photos: 0 }, ...counts];
  return (
    <select
      aria-label="EXIF value"
      className={selectClass}
      value={canonicalJson(when.value)}
      onChange={(e) =>
        onChange({ ...rule, when: { ...when, value: JSON.parse(e.target.value) as OverrideValue } })
      }
    >
      {options.map((c) => (
        <option key={canonicalJson(c.value)} value={canonicalJson(c.value)}>
          {showValue(c.value)} ({c.photos})
        </option>
      ))}
    </select>
  );
}

/** The fields the rule sets, each with its value, and a way to add another. */
function SetFields({ rule, onChange }: RuleProps) {
  const entries = Object.entries(rule.set) as [OverrideField, OverrideValue][];
  const unused = OVERRIDE_FIELDS.filter((f) => !(f.field in rule.set));
  const setAll = (pairs: [OverrideField, OverrideValue][]) =>
    onChange({ ...rule, set: Object.fromEntries(pairs) });
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([field, value], i) => (
        <SetRow
          key={field}
          field={field}
          value={value}
          choices={[field, ...unused.map((f) => f.field)]}
          onChange={(pair) =>
            setAll(pair ? entries.toSpliced(i, 1, pair) : entries.toSpliced(i, 1))
          }
        />
      ))}
      {unused[0] && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setAll([...entries, [unused[0]!.field, null]])}
        >
          <PlusIcon aria-hidden />
          Set another field
        </Button>
      )}
    </div>
  );
}

interface SetRowProps {
  field: OverrideField;
  value: OverrideValue;
  /** The fields this row can be changed to: its own and those the rule doesn't set yet. */
  choices: OverrideField[];
  /** With the new field and value, or null to stop setting it. */
  onChange: (pair: [OverrideField, OverrideValue] | null) => void;
}

function SetRow({ field, value, choices, onChange }: SetRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Set</span>
      <select
        aria-label="Field"
        className={selectClass}
        value={field}
        onChange={(e) => onChange([e.target.value as OverrideField, null])}
      >
        {choices.map((f) => (
          <option key={f} value={f}>
            {fieldLabel(f)}
          </option>
        ))}
      </select>
      <span>to</span>
      <ValueInput field={field} value={value} onChange={(v) => onChange([field, v])} />
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Stop setting ${fieldLabel(field)}`}
        onClick={() => onChange(null)}
      >
        <XIcon />
      </Button>
    </div>
  );
}

/** Whether the photo files have field as a number. */
function isNumeric(field: OverrideField): boolean {
  return OVERRIDE_FIELDS.find((f) => f.field === field)?.type === "number";
}

/** What was typed, as the photo files write field; empty is null, clearing the field. */
function typedValue(field: OverrideField, text: string): OverrideValue {
  if (text === "") return null;
  return isNumeric(field) ? Number(text) : text;
}

function ValueInput({
  field,
  value,
  onChange,
}: {
  field: OverrideField;
  value: OverrideValue;
  onChange: (value: OverrideValue) => void;
}) {
  return (
    <Input
      aria-label={`${fieldLabel(field)} to write`}
      className="w-auto min-w-48 flex-1"
      type={isNumeric(field) ? "number" : "text"}
      step="any"
      placeholder="Empty clears it"
      value={value ?? ""}
      onChange={(e) => onChange(typedValue(field, e.target.value))}
    />
  );
}
