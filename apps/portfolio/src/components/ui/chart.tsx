import type * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Trimmed-down shadcn/ui chart: a responsive container that exposes each series' color as a
// `--color-<key>` CSS variable, plus a tooltip styled like the rest of the UI.

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;

function ChartContainer({
  config,
  className,
  children,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const colorVars = Object.fromEntries(
    Object.entries(config).map(([key, { color }]) => [`--color-${key}`, color]),
  );

  return (
    <div
      data-slot="chart"
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-hidden",
        className,
      )}
      style={{ ...colorVars, ...style }}
      {...props}
    >
      <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
    </div>
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

/** Tooltip for a single series: a title from the hovered datum, then its formatted value. */
function ChartTooltipContent({
  active,
  payload,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: unknown }>;
  labelFormatter: (datum: unknown) => React.ReactNode;
  valueFormatter: (value: unknown) => React.ReactNode;
}) {
  const item = payload?.[0];
  if (!active || !item) return null;

  return (
    <div className="grid min-w-32 gap-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl">
      <div className="font-medium">{labelFormatter(item.payload)}</div>
      <div className="text-muted-foreground tabular-nums">{valueFormatter(item.value)}</div>
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
