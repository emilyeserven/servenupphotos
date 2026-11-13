import { ChartColumn, ChartColumnStacked, type LucideIcon } from "lucide-react";
import type { ConfigChange } from "@portfolio/components/graph-builder/graph-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "@portfolio/components/ui/tooltip";
import type { GraphConfig } from "@portfolio/lib/graph-data";
import { CONTROL_FRAME, controlButtonClass } from "@portfolio/lib/segmented-control";
import { cn } from "@portfolio/lib/utils";

/** What a split bar's parts can be, with their names and icons. */
export const PARTS: [boolean, string, LucideIcon][] = [
  [true, "Stacked", ChartColumnStacked],
  [false, "Side by side", ChartColumn],
];

/** Whether the graph has parts to stack: only a bar graph with a split, since line and photo dot graphs' parts don't stack. */
export function hasParts(config: GraphConfig): boolean {
  return config.type === "bar" && config.split !== "";
}

/**
 * Whether a split bar's parts are stacked or side by side, changed in place beside the **Split by**
 * dropdown: two small joined icon buttons, the chosen one pressed and each named in a tooltip. It
 * writes the same setting as Adjust Graph's **Parts**, and shows only when the graph has parts.
 */
export function PartsButtons({
  config,
  onChange,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  if (!hasParts(config)) return null;
  return (
    <div role="group" aria-label="Parts" className={cn(CONTROL_FRAME, "shrink-0")}>
      {PARTS.map(([stacked, label, Icon]) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              aria-pressed={config.stacked === stacked}
              onClick={() => onChange({ stacked })}
              className={cn(controlButtonClass(config.stacked === stacked), "h-6 px-1.5")}
            >
              <Icon aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
