import { formatValue, type GraphConfig, statById } from "@/lib/graph-data";
import type { GraphPick, PickedPhotos } from "@/lib/graph-pick";

/** A count of photos as words, such as "1 photo" or "12 photos". */
function photoCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "photo" : "photos"}`;
}

/** One labeled line: the axis's name, its stat, and the picked value. */
interface AxisLine {
  axis: string;
  stat: string;
  value: string;
}

/** What the y axis says for the pick: a dot's y value, or else how many photos (or what share) it has. */
function yLine(config: GraphConfig, pick: GraphPick, picked: PickedPhotos, total: number) {
  if (pick.y !== undefined) return { stat: statById(config.y).label, value: pick.y };
  if (config.measure === "count") return { stat: "Photos", value: picked.total.toLocaleString() };
  const share = formatValue(total > 0 ? (picked.total / total) * 100 : 0, "percent");
  return { stat: "Share of photos", value: `${share} (${photoCount(picked.total)})` };
}

/** The pick's lines: its x value, its y value, and what its photos are grouped by. */
function axisLines(
  config: GraphConfig,
  pick: GraphPick,
  picked: PickedPhotos,
  total: number,
): AxisLine[] {
  const pie = config.type === "pie";
  const lines: AxisLine[] = [
    { axis: pie ? "Slices" : "X axis", stat: statById(config.x).label, value: pick.x },
    { axis: pie ? "Size" : "Y axis", ...yLine(config, pick, picked, total) },
  ];
  if (picked.groupedBy) lines.push({ axis: "Grouped by", stat: picked.groupedBy, value: "" });
  return lines;
}

/**
 * The picked value's heading: which value is on the x axis and which on the y axis, each with
 * its stat, such as X axis · Year: 2016 and Y axis · Photos: 12, and what the groups are.
 */
export function PickAxes({
  config,
  pick,
  picked,
  total,
}: {
  config: GraphConfig;
  pick: GraphPick;
  picked: PickedPhotos;
  /** How many photos the filters keep, for a share. */
  total: number;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-sm">
      {axisLines(config, pick, picked, total).map((line) => (
        <div key={line.axis} className="contents">
          <dt className="text-xs font-medium text-muted-foreground">{line.axis}</dt>
          <dd className="min-w-0">
            <span className="text-muted-foreground">{line.stat}</span>
            {line.value && (
              <>
                <span className="text-muted-foreground">: </span>
                <span className="font-semibold tabular-nums">{line.value}</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
