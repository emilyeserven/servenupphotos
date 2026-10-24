import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ColorOrder } from "@/lib/color-sort";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

const ORDERS = [
  {
    order: "asc",
    label: "Ascending",
    title: "Red around the color wheel to rose, then black to white",
    Icon: ArrowUp,
  },
  {
    order: "desc",
    label: "Descending",
    title: "White to black, then rose around the color wheel to red",
    Icon: ArrowDown,
  },
] as const;

/**
 * Which way every photo is sorted by color when none is picked: ascending (the
 * default) or descending, kept in the URL as `?order=desc` so a link keeps it.
 */
export function ColorOrderControl({ order }: { order: ColorOrder }) {
  return (
    <div role="group" aria-label="Sort by color" className={CONTROL_FRAME}>
      {ORDERS.map(({ order: option, label, title, Icon }) => (
        <Link
          key={option}
          from="/color"
          to="/color"
          search={(prev) => ({
            ...prev,
            order: option === "asc" ? undefined : option,
            photo: undefined,
          })}
          replace
          aria-pressed={order === option}
          title={title}
          className={controlButtonClass(order === option)}
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}
