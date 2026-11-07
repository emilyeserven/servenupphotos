/** How many filters are set, as a badge; nothing when none are. */
export function FilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}
