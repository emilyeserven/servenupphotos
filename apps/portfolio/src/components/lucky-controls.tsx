import { useNavigate } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
import { GridViewOptions } from "@/components/grid-view-options";
import { type GridSize, squareSize } from "@/lib/grid-size";
import { DEFAULT_LUCKY_COUNT, LUCKY_COUNTS, type LuckyCount } from "@/lib/lucky";
import { SELECT_CLASS } from "@/lib/segmented-control";

/** How many photos a dropdown value names, the default for anything else. */
function countOf(value: string): LuckyCount {
  return LUCKY_COUNTS.find((choice) => choice === Number(value)) ?? DEFAULT_LUCKY_COUNT;
}

/**
 * A dropdown picking how many random photos the Lucky view draws, kept in the URL as `?count=`
 * (left out for the default, 12).
 */
function LuckyCountSelect({ count }: { count: LuckyCount }) {
  const navigate = useNavigate({ from: "/grid" });
  return (
    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <span className="sr-only">How many photos</span>
      <select
        value={count}
        onChange={(event) => {
          const next = countOf(event.target.value);
          void navigate({
            search: (prev) => ({ ...prev, count: next === DEFAULT_LUCKY_COUNT ? undefined : next }),
            replace: true,
          });
        }}
        className={SELECT_CLASS}
      >
        {LUCKY_COUNTS.map((choice) => (
          <option key={choice} value={choice}>
            {choice === 1 ? "1 photo" : `${choice} photos`}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The Lucky view's controls: how many photos to draw, a **Shuffle** button that draws again from
 * the photos the filters leave, and the square tiles' display options.
 */
export function LuckyControls({
  count,
  size,
  info,
  onShuffle,
}: {
  count: LuckyCount;
  /** The URL's size, left out for Square tiles' own starting size. */
  size: GridSize | undefined;
  info: boolean;
  onShuffle: () => void;
}) {
  return (
    <>
      <LuckyCountSelect count={count} />
      <button
        type="button"
        onClick={onShuffle}
        title="Draw different random photos"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30 [&_svg]:size-4"
      >
        <Shuffle aria-hidden />
        Shuffle
      </button>
      <GridViewOptions view="square" size={squareSize(size)} info={info} />
    </>
  );
}
