import type { ReactNode } from "react";

/** How an axis's name on the graph looks: plain text with a dropdown arrow, shaded on hover. */
const AXIS_CLASS =
  "field-sizing-content cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A setting named on the graph itself, such as an axis's name or what splits it: a dropdown that
 * changes it when clicked, after a small label saying what it is.
 */
export function AxisSelect({
  name,
  value,
  onChange,
  children,
}: {
  /** What the setting is, such as "X axis", before its value and for screen readers. */
  name: string;
  /** The chosen option's value. */
  value: string;
  /** Called with the option picked. */
  onChange: (value: string) => void;
  /** The dropdown's options. */
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {name}
      <select
        value={value}
        title={`Change the ${name.toLowerCase()}`}
        onChange={(e) => onChange(e.target.value)}
        className={AXIS_CLASS}
      >
        {children}
      </select>
    </label>
  );
}
