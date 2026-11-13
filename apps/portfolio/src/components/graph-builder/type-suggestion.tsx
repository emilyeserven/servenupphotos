import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@portfolio/components/ui/button";
import {
  axisRows,
  type GraphConfig,
  type GraphType,
  hasYStat,
  statById,
} from "@portfolio/lib/graph-data";
import { suggestedType, type TypeFit, typeFits } from "@portfolio/lib/graph-suggest";
import type { Photo } from "@portfolio/lib/photos";

/**
 * Each graph type's fit for what's on the graph's axes (see `typeFits`): the x axis's stat and how
 * many values it shows among the photos, and the y axis's stat while the graph compares two.
 */
export function useTypeFits(config: GraphConfig, list: Photo[]): Record<GraphType, TypeFit> {
  return useMemo(
    () =>
      typeFits({
        x: config.x,
        xCount: axisRows(list, config).length,
        y: hasYStat(config.type) ? config.y : undefined,
      }),
    [config, list],
  );
}

/** Each graph type as the nudge names it, such as "A bar graph". */
const TYPE_NOUNS: Record<GraphType, string> = {
  bar: "A bar graph",
  line: "A line graph",
  pie: "A pie",
  scatter: "A scatterplot",
  heatmap: "A heatmap",
  photos: "A photo dot graph",
};

/** The nudge's state: whether an axis changed since the type was last set, and how to watch for that. */
interface TypeNudgeState {
  /** Whether the visitor changed an axis since the type, or a preset, was last picked. */
  armed: boolean;
  /** Reads a change to the graph: a new type stops the nudge, a new axis starts watching. */
  watch: (change: Partial<GraphConfig>) => void;
  /** Hides the nudge until the visitor changes an axis again. */
  dismiss: () => void;
}

/**
 * Whether the type nudge may show: only once the visitor changes an axis, never for the graph the
 * page opened on or a preset they picked.
 */
export function useTypeNudge(): TypeNudgeState {
  const [armed, setArmed] = useState(false);
  const watch = (change: Partial<GraphConfig>) => {
    if ("type" in change) setArmed(false);
    else if ("x" in change || "y" in change) setArmed(true);
  };
  return { armed, watch, dismiss: () => setArmed(false) };
}

/**
 * One small line over the graph, once the visitor's axis change leaves the type a poor fit, such
 * as "A bar graph suits Lenses better.", with **Switch** to set that type and an X to hide it. It
 * never changes the type by itself, and goes away once the type fits.
 */
export function TypeNudge({
  armed,
  config,
  list,
  onSwitch,
  onDismiss,
}: {
  armed: boolean;
  config: GraphConfig;
  /** The photos the filters keep, whose x values a pie's slices are counted from. */
  list: Photo[];
  onSwitch: (type: GraphType) => void;
  onDismiss: () => void;
}) {
  const fits = useTypeFits(config, list);
  const better = suggestedType(fits);
  if (!armed || fits[config.type].fit !== "poor" || !better) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        {TYPE_NOUNS[better]} suits {statById(config.x).label} better.
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => onSwitch(better)}>
        Switch
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
