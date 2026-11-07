import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GRAPH_STATS, type GraphStat } from "@portfolio/lib/graph-data";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** One of the graph builder's settings: its icon and name over its control. */
export function GraphField({
  label,
  icon,
  children,
}: {
  label: string;
  /** The icon before its name, such as a chart for the graph's type. */
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
      <FieldName label={label} icon={icon} />
      {children}
    </label>
  );
}

/** A setting's name, with its icon before it when it has one. */
export function FieldName({ label, icon: Icon }: { label: string; icon?: LucideIcon }) {
  return (
    <span className="flex items-center gap-1.5">
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {label}
    </span>
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
