/** A local date as YYYY-MM-DD. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** YYYY-MM-DD as a local date at midnight. */
export function parseIsoDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The Sunday that starts date's week, at midnight. */
function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** `weeks` weeks of days from the Sunday `offset` weeks after this week's, as YYYY-MM-DD. */
export function calendarDays(today: Date, offset: number, weeks: number): string[] {
  const first = addDays(startOfWeek(today), offset * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => isoDate(addDays(first, i)));
}
