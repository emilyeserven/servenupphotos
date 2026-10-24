/** A date and time's parts, as numbers would be read from them. */
type DateParts = [
  year: string,
  month: string,
  day: string,
  hour: string,
  minute: string,
  second: string,
];

/** The lowest and highest each part can be: year, month, day, hour, minute and second. */
const RANGES: [number, number][] = [
  [1900, 2999],
  [1, 12],
  [1, 31],
  [0, 23],
  [0, 59],
  [0, 59],
];

/** Whether the parts are a real-looking date and time, so a run of digits isn't read as one. */
function isPlausible(parts: DateParts): boolean {
  return parts.every((part, i) => {
    const [low = 0, high = 0] = RANGES[i] ?? [];
    return Number(part) >= low && Number(part) <= high;
  });
}

/** The parts written as exiftool writes dates, such as "2016:12:23 22:07:39". */
function exifDate([year, month, day, hour, minute, second]: DateParts): string {
  return `${year}:${month}:${day} ${hour}:${minute}:${second}`;
}

/**
 * The date and time a phone or camera wrote into the file name, such as IMG_20161223_220739_041 or
 * PXL_20230101_123456789, as exiftool writes dates; null when the name has none.
 */
export function dateFromFileName(name: string): string | null {
  const match = name.match(/(\d{4})-?(\d{2})-?(\d{2})[_\- T]?(\d{2})[-.:]?(\d{2})[-.:]?(\d{2})/);
  const parts = match?.slice(1) as DateParts | undefined;
  return parts && isPlausible(parts) ? exifDate(parts) : null;
}

/** An exiftool date as a date-time input's value ("2016-12-23T22:07:39"); "" when it isn't one. */
export function inputValue(date: string): string {
  const match = date.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}(?::\d{2})?)/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}` : "";
}

/** A date-time input's value as exiftool writes dates, with seconds; "" when it's empty. */
export function fromInputValue(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})(:\d{2})?/);
  return match ? `${match[1]}:${match[2]}:${match[3]} ${match[4]}${match[5] ?? ":00"}` : "";
}

/** An exiftool date as it reads, such as "Dec 23, 2016, 10:07:39 PM"; the text itself when it isn't one. */
export function readableDate(date: string): string {
  const value = inputValue(date);
  return value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
    : date;
}
