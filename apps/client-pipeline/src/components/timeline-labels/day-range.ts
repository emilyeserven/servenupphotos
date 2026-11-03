/** A day such as "2026-09-22" as "Sep 22, 2026". */
function dayText(day: string): string {
  return new Date(`${day}T00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The days from start to end, such as "Sep 22, 2026 – Oct 2, 2026", or one day when they're the same. */
export function dayRange(start: string, end: string): string {
  return start === end ? dayText(start) : `${dayText(start)} – ${dayText(end)}`;
}
