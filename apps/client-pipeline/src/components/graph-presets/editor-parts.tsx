import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";

/** A setting in a preset or group editor: its name over its control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

interface NameOrderProps {
  name: string;
  order: number;
  /** An example name, such as "Aperture". */
  placeholder: string;
  onChange: (part: { name?: string; order?: number }) => void;
}

/** The name the Graph page shows, and where it sits among the others. */
export function NameAndOrder({ name, order, placeholder, onChange }: NameOrderProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <Field label="Name, as the Graph page shows it">
        <Input
          value={name}
          placeholder={placeholder}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field label="Order">
        <Input
          type="number"
          min={0}
          value={order}
          onChange={(e) => onChange({ order: Math.max(0, Math.round(Number(e.target.value))) })}
        />
      </Field>
    </div>
  );
}

/** Why a preset or group can't be saved yet, or "" when it can. */
export function whyNotPreset(next: { name: string }): string {
  return next.name === "" ? "Give it a name." : "";
}
