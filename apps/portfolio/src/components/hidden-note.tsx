/** How many of a filter's choices are hidden as they'd show no photos given the other filters. */
export function hiddenText(count: number, noun: string): string {
  return `${count} ${noun} hidden by the other filters`;
}

/** A note under a filter's choices saying how many are hidden; nothing when none are. */
export function HiddenNote({ count, noun }: { count: number; noun: string }) {
  if (count === 0) return null;
  return <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{hiddenText(count, noun)}</p>;
}
