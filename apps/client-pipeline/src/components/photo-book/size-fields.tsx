import { Input } from "@/components/ui/input";
import {
  type BookSize,
  DEFAULT_SIZE,
  type PhotoBook,
  SIZE_UNITS,
  pageAspect,
} from "@/lib/photo-book";

const SELECT =
  "border-input dark:bg-input/30 h-9 min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs";

/** What each unit is called in the unit picker. */
const UNIT_NAMES: Record<BookSize["unit"], string> = {
  in: "inches",
  cm: "centimeters",
  mm: "millimeters",
  pt: "points",
  px: "pixels",
};

/** A side typed in the size fields as a number, or 0 for one that isn't. */
function sideOf(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The book's page size: width, height and unit, starting from BookWright's large landscape page,
 * and the shape they give the pages. A side that isn't a number more than 0 isn't saved.
 */
export function SizeFields({
  book,
  onChange,
}: {
  book: PhotoBook;
  onChange: (b: PhotoBook) => void;
}) {
  const size = book.size ?? DEFAULT_SIZE;
  const set = (change: Partial<BookSize>) => {
    const next = { ...size, ...change };
    if (next.width > 0 && next.height > 0) onChange({ ...book, size: next });
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Page size</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Width</span>
          <Input
            type="number"
            min={0}
            step="any"
            defaultValue={size.width}
            onChange={(event) => set({ width: sideOf(event.target.value) })}
            className="w-28"
          />
        </label>
        <span className="pb-2 text-sm">×</span>
        <label className="flex flex-col gap-1 text-sm">
          <span>Height</span>
          <Input
            type="number"
            min={0}
            step="any"
            defaultValue={size.height}
            onChange={(event) => set({ height: sideOf(event.target.value) })}
            className="w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Unit</span>
          <select
            value={size.unit}
            onChange={(event) => set({ unit: event.target.value as BookSize["unit"] })}
            className={SELECT}
          >
            {SIZE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_NAMES[unit]}
              </option>
            ))}
          </select>
        </label>
        <ShapeSwatch aspect={pageAspect(book)} />
      </div>
      <p className="text-muted-foreground text-xs">
        Starts at BookWright&apos;s large landscape page, 12.5 × 10.625 in. Only the shape is used,
        so the unit just has to match the numbers.
      </p>
    </fieldset>
  );
}

/** A small page in the size's shape, with its ratio. */
function ShapeSwatch({ aspect }: { aspect: number }) {
  return (
    <span className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="block h-8 rounded-[2px] border border-neutral-700 bg-black"
        style={{ aspectRatio: aspect }}
      />
      {aspect.toFixed(3)} : 1
    </span>
  );
}
