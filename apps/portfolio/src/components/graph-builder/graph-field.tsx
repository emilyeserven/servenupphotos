import { GRAPH_STATS, type GraphStat } from "@portfolio/lib/graph-data";

/** The stats, by the section they're in, such as Gear, as the dropdowns and the Graph type picker list them. */
export function statsBySection(): [string, GraphStat[]][] {
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
