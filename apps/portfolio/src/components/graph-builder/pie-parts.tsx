import { type MouseEvent, type ReactNode, useState } from "react";
import { useGraphDisplay } from "@/components/graph-builder/graph-display";
import { formatValue, type Measure } from "@/lib/graph-data";
import { pieLabelPlaces } from "@/lib/pie-label-layout";
import { useSize } from "@/lib/use-size";

/** How wide the pie's box needs to be, in pixels, for its slices to have room for their names. */
const LABELS_WIDTH = 560;

/** The longest a slice's name runs before it's cut short. */
const MAX_NAME = 24;

/** What recharts hands a slice's label: where the pie is, which slice this is, its color and its datum. */
interface SliceLabelProps {
  cx: number;
  cy: number;
  outerRadius: number;
  index: number;
  fill: string;
  payload: { label: string; value: number };
}

/** What a slice's label needs besides recharts' props: every slice's size, the box's height and the measure. */
interface SliceLabelContext {
  values: number[];
  height: number;
  measure: Measure;
}

/** A slice's name, cut short past `MAX_NAME` letters. */
function sliceName(label: string): string {
  return label.length > MAX_NAME ? `${label.slice(0, MAX_NAME - 1)}…` : label;
}

/**
 * A slice's name and value beside the pie, with a line in the slice's color from the slice to it. Each side's
 * names are spaced so they and their lines never overlap (`lib/pie-label-layout.ts`).
 */
function SliceLabel({
  cx,
  cy,
  outerRadius,
  index,
  fill,
  payload,
  values,
  height,
  measure,
}: SliceLabelProps & SliceLabelContext) {
  const place = pieLabelPlaces(values, { cx, cy, radius: outerRadius, height })[index];
  if (!place) return null;
  return (
    <g>
      <polyline
        points={place.points.map((point) => point.join(",")).join(" ")}
        fill="none"
        stroke={fill}
        strokeWidth={1}
      />
      <text
        x={place.x}
        y={place.y}
        textAnchor={place.side === "right" ? "start" : "end"}
        dominantBaseline="central"
        className="fill-muted-foreground text-xs"
      >
        {sliceName(payload.label)}
        <tspan className="fill-foreground font-medium tabular-nums">
          {` ${formatValue(payload.value, measure)}`}
        </tspan>
      </text>
    </g>
  );
}

/** How a pie draws its slices: named around it and a little smaller to make room, or plain. */
interface PieLabels {
  label: false | ((props: object) => ReactNode);
  labelLine: false;
  outerRadius: string;
}

/** The pie with no names around it. */
const PLAIN: PieLabels = { label: false, labelLine: false, outerRadius: "85%" };

/** The pie with each slice's name and value around it; each label draws its own line. */
function named(context: SliceLabelContext): PieLabels {
  return {
    label: (props) => <SliceLabel {...(props as SliceLabelProps)} {...context} />,
    labelLine: false,
    outerRadius: "70%",
  };
}

/**
 * A ref for the pie's box, and how its slices (sized by `values`) are drawn: each one's name and value around
 * the pie while **Slice names and values** is on in the display options (it is at first) and the box is wide
 * enough to fit them (`LABELS_WIDTH`); plain otherwise, such as on phones, where the key names them.
 */
export function usePieLabels(measure: Measure, values: number[]) {
  const [ref, size] = useSize();
  const { sliceLabels } = useGraphDisplay();
  const show = sliceLabels && size.width >= LABELS_WIDTH;
  return [ref, show ? named({ values, height: size.height, measure }) : PLAIN] as const;
}

/** How far from the cursor the tooltip sits, in pixels, so it doesn't hide what's under it. */
const CURSOR_GAP = 12;

/**
 * Where the pie's tooltip goes: beside the cursor, following it across the slices, instead of
 * fixed at the slice's middle. Hand `onMouseMove` to the pie's box and `position` to its tooltip.
 */
export function useCursorTooltip() {
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const onMouseMove = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: event.clientX - box.left + CURSOR_GAP,
      y: event.clientY - box.top + CURSOR_GAP,
    });
  };
  return { position, onMouseMove };
}
