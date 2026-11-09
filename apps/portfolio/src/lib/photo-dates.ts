/** Exiftool's "2026:05:16 15:24:10" (sometimes with a time zone after it), as local time. */
export function parseCreateDate(value: string | null): Date | null {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  // An ISO date and time without a time zone is read as local time.
  const [, year, month, day, time] = match;
  return new Date(`${year}-${month}-${day}T${time}`);
}

/** The pipeline's "2026-10-25T04:10:22Z", or null when there's none or it can't be read. */
export function parseAddedDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
