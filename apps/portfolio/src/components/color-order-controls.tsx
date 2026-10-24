import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ColorOrder, ColorSort } from "@/lib/color-sort";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** Each sort's name in "Then by …". */
const SORT_LABELS: Record<ColorSort, string> = { color: "Color", vivid: "Vividness" };

/** What ascending and descending mean for each sort. */
const ORDER_TITLES: Record<ColorSort, Record<ColorOrder, string>> = {
  color: {
    asc: "Red around the color wheel to rose, secondary black to white; or the most of the picked color first",
    desc: "White to black, secondary rose around the color wheel to red; or the least of the picked color first",
  },
  vivid: { asc: "Least vivid first", desc: "Most vivid first" },
};

const ORDERS = [
  { order: "asc", label: "Ascending", Icon: ArrowUp },
  { order: "desc", label: "Descending", Icon: ArrowDown },
] as const;

/** The URL keys an order toggle sets: the main sort's way, or the secondary sort's. */
type OrderParam = "order" | "secondaryOrder";

/**
 * Which way the Grid's color or vividness sort runs, and optionally the other one as a secondary
 * sort within the groups the first makes, with its own way. Kept in the URL as `?order=desc`,
 * `?secondary=` and `?secondaryOrder=desc`, each left out at its default, so a link keeps them.
 */
export function ColorOrderControls({
  sort,
  order,
  secondary,
  secondaryOrder,
}: {
  sort: ColorSort;
  order: ColorOrder;
  /** The secondary sort, always the one sort isn't; undefined for none. */
  secondary: ColorSort | undefined;
  secondaryOrder: ColorOrder;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <OrderToggle sort={sort} order={order} param="order" />
      <ThenToggle other={sort === "color" ? "vivid" : "color"} on={secondary !== undefined} />
      {secondary && <OrderToggle sort={secondary} order={secondaryOrder} param="secondaryOrder" />}
    </div>
  );
}

/** Whether a secondary sort by other is on, kept in the URL as `?secondary=`. */
function ThenToggle({ other, on }: { other: ColorSort; on: boolean }) {
  return (
    <Link
      to="."
      search={(prev) => ({
        ...prev,
        secondary: on ? undefined : other,
        secondaryOrder: undefined,
        photo: undefined,
      })}
      replace
      aria-pressed={on}
      title={`Within each group, also sort by ${SORT_LABELS[other].toLowerCase()}`}
      className={`${CONTROL_FRAME} ${controlButtonClass(on)}`}
    >
      Then by {SORT_LABELS[other].toLowerCase()}
    </Link>
  );
}

/** Ascending or descending for sort, each titled with what it means, set on param. */
function OrderToggle({
  sort,
  order,
  param,
}: {
  sort: ColorSort;
  order: ColorOrder;
  param: OrderParam;
}) {
  return (
    <div role="group" aria-label={`${SORT_LABELS[sort]} order`} className={CONTROL_FRAME}>
      {ORDERS.map(({ order: option, label, Icon }) => (
        <Link
          key={option}
          to="."
          search={(prev) => ({ ...prev, ...orderSearch(param, option), photo: undefined })}
          replace
          aria-pressed={order === option}
          title={ORDER_TITLES[sort][option]}
          className={controlButtonClass(order === option)}
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}

/** The URL change that sets param to order, leaving it out for ascending. */
function orderSearch(param: OrderParam, order: ColorOrder) {
  const value = order === "desc" ? order : undefined;
  return param === "order" ? { order: value } : { secondaryOrder: value };
}
