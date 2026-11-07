import type { ReactNode } from "react";
import { GRAPH_STATS, type GraphStat } from "@/lib/graph-data";
import { SELECT_CLASS } from "@/lib/segmented-control";

/** One of the graph builder's settings: its name over its control. */
export function GraphField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

/** The stats, by the section they're in, such as Gear. */
function statsBySection(): [string, GraphStat[]][] {
  const sections = new Map<string, GraphStat[]>();
  for (const stat of GRAPH_STATS)
    sections.set(stat.section, [...(sections.get(stat.section) ?? []), stat]);
  return [...sections];
}

/** The stats as a dropdown's options, under their sections; the ones in `leaveOut` left out. */
export function StatOptions({ leaveOut = [] }: { leaveOut?: string[] }) {
  return statsBySection().map(([section, stats]) => (
    <optgroup key={section} label={section}>
      {stats
        .filter((stat) => !leaveOut.includes(stat.id))
        .map((stat) => (
          <option key={stat.id} value={stat.id}>
            {stat.label}
          </option>
        ))}
    </optgroup>
  ));
}

/** A dropdown of the stats, such as the x axis's. */
export function StatSelect({
  value,
  onChange,
  leaveOut,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  leaveOut?: string[];
  /** Its name for screen readers, when it isn't inside a `GraphField`. */
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <StatOptions leaveOut={leaveOut} />
    </select>
  );
}
