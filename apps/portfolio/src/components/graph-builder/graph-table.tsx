import type { ReactNode } from "react";
import { formatValue, type GraphData, type Measure, type ScatterData } from "@/lib/graph-data";

/** A plain table with a header row, scrolling sideways when it's wider than the card. */
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            {head.map((cell, index) => (
              <th key={index} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row, index) => (
            <tr key={index} className="border-t">
              {row.map((cell, i) => (
                <td key={i} className="px-3 py-1.5 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A bar, line or pie graph's numbers as a table: a row for each x value, a column for each series. */
export function GraphTable({
  graph,
  measure,
  xName,
}: {
  graph: GraphData;
  measure: Measure;
  xName: string;
}) {
  const head = [
    xName,
    "Photos",
    ...(graph.series.length > 1 ? graph.series.map((s) => s.label) : []),
  ];
  const share = measure === "percent" && graph.series.length === 1;
  const rows = graph.data.map((datum) => [
    datum.label,
    datum.photos.toLocaleString(),
    ...(graph.series.length > 1
      ? graph.series.map((s) => formatValue(datum.values[s.key] ?? 0, measure))
      : []),
    ...(share ? [formatValue(datum.values.value ?? 0, measure)] : []),
  ]);
  return <Table head={share ? [...head, "Share"] : head} rows={rows} />;
}

/** A scatterplot's dots as a table: each pair of values with how many photos have both. */
export function ScatterTable({
  data,
  xName,
  yName,
}: {
  data: ScatterData;
  xName: string;
  yName: string;
}) {
  const rows = data.points.map((point) => [
    data.xLabels[point.x],
    data.yLabels[point.y],
    point.count.toLocaleString(),
  ]);
  return <Table head={[xName, yName, "Photos"]} rows={rows} />;
}
