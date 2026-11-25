import { count } from "@portfolio/lib/words";

/**
 * **Show hidden alternates**, beside the Photo Pages views, which also shows the alternates that
 * lost to the one picked from their group; nothing when none is hidden.
 */
export function ShowHiddenToggle(props: {
  /** How many pages and spreads are hidden. */
  hidden: number;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const { hidden, on, onChange } = props;
  if (hidden === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
      />
      Show hidden alternates ({count(hidden, "page or spread", "pages and spreads")})
    </label>
  );
}
