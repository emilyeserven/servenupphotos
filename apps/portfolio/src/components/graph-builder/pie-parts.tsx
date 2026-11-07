import { type MouseEvent, type ReactNode, useState } from "react";
import { useGraphDisplay } from "@/components/graph-builder/graph-display";
import { formatValue, type Measure } from "@/lib/graph-data";
import { useSize } from "@/lib/use-size";

/** How wide the pie's box needs to be, in pixels, for its slices to have room for their names. */
const LABELS_WIDTH = 560;

/** How far past the pie's edge a slice's name sits, in pixels. */
const LABEL_GAP = 26;

/** The longest a slice's name runs before it's cut short. */
const MAX_NAME = 24;

/** What recharts hands a slice's label: where the slice is, and its datum. */
interface SliceLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  payload: { label: string; value: number };
}

/** A slice's name, cut short past `MAX_NAME` letters. */
function sliceName(label: string): string {
  return label.length > MAX_NAME ? `${label.slice(0, MAX_NAME - 1)}…` : label;
}

/** A slice's name and value just outside its middle, leaning away from the pie. */
function SliceLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  payload,
  measure,
}: SliceLabelProps & { measure: Measure }) {
  const angle = (-midAngle * Math.PI) / 180;
  const x = cx + (outerRadius + LABEL_GAP) * Math.cos(angle);
  const y = cy + (outerRadius + LABEL_GAP) * Math.sin(angle);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-muted-foreground text-xs"
    >
      {sliceName(payload.label)}
      <tspan className="fill-foreground font-medium tabular-nums">
        {` ${formatValue(payload.value, measure)}`}
      </tspan>
    </text>
  );
}

/** How a pie draws its slices: named around it and a little smaller to make room, or plain. */
interface PieLabels {
  label: false | ((props: object) => ReactNode);
  labelLine: boolean;
  outerRadius: string;
}

/** The pie with no names around it. */
const PLAIN: PieLabels = { label: false, labelLine: false, outerRadius: "85%" };

/** The pie with each slice's name and value around it. */
function named(measure: Measure): PieLabels {
  return {
    label: (props) => <SliceLabel {...(props as SliceLabelProps)} measure={measure} />,
    labelLine: true,
    outerRadius: "70%",
  };
}

/**
 * A ref for the pie's box, and how its slices are drawn: each one's name and value around the pie
 * while **Slice names and values** is on in the display options (it is at first) and the box is
 * wide enough to fit them (`LABELS_WIDTH`); plain otherwise, such as on phones, where the key names
 * them.
 */
export function usePieLabels(measure: Measure) {
  const [ref, size] = useSize();
  const { sliceLabels } = useGraphDisplay();
  const show = sliceLabels && size.width >= LABELS_WIDTH;
  return [ref, show ? named(measure) : PLAIN] as const;
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
