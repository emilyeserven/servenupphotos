import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ColorOrder, ColorSort } from "@/lib/color-sort";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

const SORTS = [
  {
    sort: "color",
    label: "Color",
    title: "Sort by color: around the color wheel, then the shades",
  },
  { sort: "vivid", label: "Vividness", title: "Sort by how vivid each photo's colors are" },
] as const;

/** What ascending and descending mean for each sort. */
const ORDER_TITLES: Record<ColorSort, Record<ColorOrder, string>> = {
  color: {
    asc: "Red around the color wheel to rose, then black to white",
    desc: "White to black, then rose around the color wheel to red",
  },
  vivid: { asc: "Least vivid first", desc: "Most vivid first" },
};

const ORDERS = [
  { order: "asc", label: "Ascending", Icon: ArrowUp },
  { order: "desc", label: "Descending", Icon: ArrowDown },
] as const;

/**
 * What every photo is sorted by, color (the default) or vividness, and which way, kept in the URL
 * as `?sort=vivid` and `?order=desc` so a link keeps them. The way is hidden when photos of one
 * color are sorted by how much of it they have.
 */
export function ColorSortControl({
  sort,
  order,
  showOrder,
}: {
  sort: ColorSort;
  order: ColorOrder;
  showOrder: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Sort by" className={CONTROL_FRAME}>
        {SORTS.map((option) => (
          <Link
            key={option.sort}
            from="/color"
            to="/color"
            search={(prev) => ({
              ...prev,
              sort: defaultless(option.sort, "color"),
              photo: undefined,
            })}
            replace
            aria-pressed={sort === option.sort}
            title={option.title}
            className={controlButtonClass(sort === option.sort)}
          >
            {option.label}
          </Link>
        ))}
      </div>
      {showOrder && <OrderToggle sort={sort} order={order} />}
    </div>
  );
}

/** Ascending or descending, each titled with what it means for sort. */
function OrderToggle({ sort, order }: { sort: ColorSort; order: ColorOrder }) {
  return (
    <div role="group" aria-label="Sort order" className={CONTROL_FRAME}>
      {ORDERS.map(({ order: option, label, Icon }) => (
        <Link
          key={option}
          from="/color"
          to="/color"
          search={(prev) => ({ ...prev, order: defaultless(option, "asc"), photo: undefined })}
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

/** value, or undefined when it's the default, so the URL leaves it out. */
function defaultless<T extends string>(
  value: T,
  fallback: string,
): Exclude<T, typeof fallback> | undefined {
  return value === fallback ? undefined : (value as Exclude<T, typeof fallback>);
}
