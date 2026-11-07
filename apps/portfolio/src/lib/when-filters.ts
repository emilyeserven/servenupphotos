import { CalendarDays, CalendarRange, type LucideIcon, Sunrise } from "lucide-react";
import type { FilterOption } from "@portfolio/lib/filter-options";
import type { Photo } from "@portfolio/lib/photos";

/**
 * The "when" filters every view with filters shares, as they're named in the URL: the part of the
 * day, the season, the month and the day of the week the photo was taken on.
 */
export const WHEN_KEYS = ["daypart", "season", "month", "weekday"] as const;

export type WhenKey = (typeof WHEN_KEYS)[number];

/** One choice of a "when" filter: its URL value, its name, and whether a photo is in it. */
export interface WhenChoice {
  key: WhenKey;
  value: string;
  label: string;
  /** A second, quieter line, such as a part of the day's hours. */
  detail?: string;
  /** How deep it goes in its dropdown: a month is under its season. */
  depth: number;
  matches: (photo: Photo) => boolean;
}

/** An hour as a 12-hour clock writes it, such as "5 AM" or "12 PM". */
function hourText(hour: number): string {
  return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** A part of the day, from the start of its first hour to the end of its last. */
function daypart(value: string, label: string, first: number, last: number): WhenChoice {
  return {
    key: "daypart",
    value,
    label,
    detail: `${hourText(first)}–${hourText(last + 1)}`,
    depth: 0,
    matches: (photo) => photo.takenAt.getHours() >= first && photo.takenAt.getHours() <= last,
  };
}

/**
 * The parts of the day, by the clock where the photo was taken, as its capture time has no time
 * zone.
 */
export const DAYPARTS: WhenChoice[] = [
  daypart("late-night", "Late night", 0, 4),
  daypart("early-morning", "Early morning", 5, 7),
  daypart("morning", "Morning", 8, 11),
  daypart("afternoon", "Afternoon", 12, 16),
  daypart("evening", "Evening", 17, 20),
  daypart("night", "Night", 21, 23),
];

/** A month's name, such as "March" or "Mar", for its number from 0. */
function monthName(month: number, style: "short" | "long" = "long"): string {
  return new Date(2000, month, 1).toLocaleString("en-US", { month: style });
}

/** A month, by its number from 0, with its lowercase English name in the URL, such as "march". */
function monthChoice(number: number): WhenChoice {
  return {
    key: "month",
    value: monthName(number).toLowerCase(),
    label: monthName(number),
    depth: 1,
    matches: (photo) => photo.takenAt.getMonth() === number,
  };
}

/** A season, by the months it starts and ends with, as the northern hemisphere has them. */
function season(value: string, label: string, months: number[]): WhenChoice {
  return {
    key: "season",
    value,
    label,
    detail: `${monthName(months[0]!, "short")}–${monthName(months.at(-1)!, "short")}`,
    depth: 0,
    matches: (photo) => months.includes(photo.takenAt.getMonth()),
  };
}

/** The seasons, winter wrapping round the new year. */
export const SEASONS: WhenChoice[] = [
  season("spring", "Spring", [2, 3, 4]),
  season("summer", "Summer", [5, 6, 7]),
  season("autumn", "Autumn", [8, 9, 10]),
  season("winter", "Winter", [11, 0, 1]),
];

/** The months, January first. */
export const MONTHS: WhenChoice[] = Array.from({ length: 12 }, (_, number) => monthChoice(number));

/** Each season, with its months under it, for the **Time of year** dropdown. */
const TIMES_OF_YEAR: WhenChoice[] = [
  SEASONS[0]!,
  ...MONTHS.slice(2, 5),
  SEASONS[1]!,
  ...MONTHS.slice(5, 8),
  SEASONS[2]!,
  ...MONTHS.slice(8, 11),
  SEASONS[3]!,
  MONTHS[11]!,
  ...MONTHS.slice(0, 2),
];

/** A day of the week, by its number as `getDay()` counts, from Sunday. */
function weekday(day: number): WhenChoice {
  // 2023-01-01 was a Sunday.
  const label = new Date(2023, 0, 1 + day).toLocaleString("en-US", { weekday: "long" });
  return {
    key: "weekday",
    value: label.toLowerCase(),
    label,
    depth: 0,
    matches: (photo) => photo.takenAt.getDay() === day,
  };
}

/** The days of the week, Monday first. */
export const WEEKDAYS: WhenChoice[] = [1, 2, 3, 4, 5, 6, 0].map(weekday);

/** Every "when" choice, to find one by its key and value. */
const ALL_CHOICES = [...DAYPARTS, ...SEASONS, ...MONTHS, ...WEEKDAYS];

/** Whether the photo was taken in the "when" filter's choice; none is in a choice that isn't there. */
export function matchesWhen(photo: Photo, key: WhenKey, value: string): boolean {
  const choice = ALL_CHOICES.find((c) => c.key === key && c.value === value);
  return choice !== undefined && choice.matches(photo);
}

/** A "when" dropdown: its name and icon, the URL keys it sets, and its choices in order. */
export interface WhenDropdown {
  label: string;
  plural: string;
  Icon: LucideIcon;
  keys: readonly WhenKey[];
  choices: WhenChoice[];
}

/** The **Time of day**, **Time of year** and **Day of the week** dropdowns. */
export const WHEN_DROPDOWNS: WhenDropdown[] = [
  {
    label: "Time of day",
    plural: "times of day",
    Icon: Sunrise,
    keys: ["daypart"],
    choices: DAYPARTS,
  },
  {
    label: "Time of year",
    plural: "times of year",
    Icon: CalendarRange,
    keys: ["season", "month"],
    choices: TIMES_OF_YEAR,
  },
  {
    label: "Day of the week",
    plural: "days",
    Icon: CalendarDays,
    keys: ["weekday"],
    choices: WEEKDAYS,
  },
];

/** A choice's name, the same in every script, with its detail after it. */
function choiceLabel({ label, detail }: WhenChoice) {
  const text = detail ? `${label} · ${detail}` : label;
  return { english: text, romanized: text, phonetic: text, native: text };
}

/** A dropdown's choices, each counting the photos of `facet` it would show. */
export function whenOptions(dropdown: WhenDropdown, facet: Photo[]): FilterOption[] {
  return dropdown.choices.map((choice) => ({
    key: choice.key,
    value: choice.value,
    label: choiceLabel(choice),
    depth: choice.depth,
    count: facet.filter(choice.matches).length,
  }));
}
