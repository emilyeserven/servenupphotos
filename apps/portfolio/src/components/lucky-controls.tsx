import { useNavigate } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
import { DEFAULT_LUCKY_ROWS, type LuckyChoice, LUCKY_ROWS, type LuckyRows } from "@/lib/lucky";
import { SELECT_CLASS } from "@/lib/segmented-control";

/** How many rows a dropdown value names, the default for anything else. */
function rowsOf(value: string): LuckyRows {
  return LUCKY_ROWS.find((choice) => choice === Number(value)) ?? DEFAULT_LUCKY_ROWS;
}

/** A choice's label, such as "15 photos (3 rows)". */
function choiceLabel({ rows, photos }: LuckyChoice): string {
  const photoText = photos === 1 ? "1 photo" : `${photos} photos`;
  return `${photoText} (${rows === 1 ? "1 row" : `${rows} rows`})`;
}

/**
 * A dropdown picking how many photos the Lucky page draws, offered in whole rows so every row is
 * full, kept in the URL as `?rows=` (left out for the default, 3 rows).
 */
export function LuckyRowsSelect({ rows, choices }: { rows: LuckyRows; choices: LuckyChoice[] }) {
  const navigate = useNavigate({ from: "/lucky" });
  return (
    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <span className="sr-only">How many photos</span>
      <select
        value={rows}
        onChange={(event) => {
          const next = rowsOf(event.target.value);
          void navigate({
            search: (prev) => ({ ...prev, rows: next === DEFAULT_LUCKY_ROWS ? undefined : next }),
            replace: true,
          });
        }}
        className={SELECT_CLASS}
      >
        {choices.map((choice) => (
          <option key={choice.rows} value={choice.rows}>
            {choiceLabel(choice)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A **Shuffle** button that draws again from the photos the filters leave. */
export function ShuffleButton({ onShuffle }: { onShuffle: () => void }) {
  return (
    <button
      type="button"
      onClick={onShuffle}
      title="Draw different random photos"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30 [&_svg]:size-4"
    >
      <Shuffle aria-hidden />
      Shuffle
    </button>
  );
}
