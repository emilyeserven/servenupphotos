/**
 * How big a mark's tick is: 0 for a plain month or day, 1 for the first day of a month, and 2 for
 * the first month or day of a year.
 */
export type TickLevel = 0 | 1 | 2;

/**
 * A month's or a day's place on the Timeline's scrubber: its name in the bubble, the group it's
 * labeled under along the scrubber (a month's year, or a day's month), its year, how far down the
 * list it starts, from 0 to 1, and how big its tick is.
 */
export interface ScrubberMark {
  month: string;
  group: string;
  year: string;
  at: number;
  level: TickLevel;
}

/** Where the list of months sits on the page, and where each month starts in it. */
export interface MonthLayout {
  /** The list's top, in pixels from the top of the page. */
  top: number;
  /** The list's height in pixels. */
  height: number;
  marks: ScrubberMark[];
  /** Each day shown in the list, with its timeline label ("" for none), in order. */
  days: DayMark[];
}

/** A day's place in the list, from 0 to 1, and its timeline label, "" when it has none. */
export interface DayMark {
  label: string;
  at: number;
}

/**
 * Measures the list of months, whose sections carry their heading in `data-month`, and the days in
 * them (`data-day`, named with their year in `data-name`), each with its group in `data-group`
 * and its year in `data-year`. `byDay` makes each day a mark instead of each month.
 */
export function measureMonths(list: HTMLElement, byDay = false): MonthLayout {
  const listBox = list.getBoundingClientRect();
  const height = Math.max(1, listBox.height);
  const sections = list.querySelectorAll<HTMLElement>(
    byDay ? "[data-day]" : ":scope > [data-month]",
  );
  const at = (element: HTMLElement) => (element.getBoundingClientRect().top - listBox.top) / height;
  const marks = withLevels(
    [...sections].map((section) => ({
      month: markName(section, byDay),
      group: section.dataset.group ?? "",
      year: section.dataset.year ?? "",
      at: at(section),
    })),
  );
  const days = [...list.querySelectorAll<HTMLElement>("[data-day]")].map((day) => ({
    label: day.dataset.label ?? "",
    at: at(day),
  }));
  return { top: listBox.top + window.scrollY, height, marks, days };
}

/** What the bubble names a section: a day with its year, or a month's heading. */
function markName(section: HTMLElement, byDay: boolean): string {
  const { name, day, month } = section.dataset;
  return (byDay ? (name ?? day) : month) ?? "";
}

/** The marks with each one's tick size, from where its group and year change. */
function withLevels(marks: Omit<ScrubberMark, "level">[]): ScrubberMark[] {
  return marks.map((mark, index) => ({ ...mark, level: tickLevel(mark, marks[index - 1]) }));
}

/**
 * A mark's tick size: the first mark in the list and a year's first month or day are the
 * biggest, and any other first of a group, such as a month's first day, is next.
 */
function tickLevel(mark: Omit<ScrubberMark, "level">, previous?: Omit<ScrubberMark, "level">) {
  if (previous?.group === mark.group) return 0;
  return startsYear(mark, previous) ? 2 : 1;
}

/**
 * Whether a mark starts a year: it's the first in the list, its group is the year, or it's in a
 * different year from the one before.
 */
function startsYear(mark: Omit<ScrubberMark, "level">, previous?: Omit<ScrubberMark, "level">) {
  return previous === undefined || mark.group === mark.year || previous.year !== mark.year;
}

/**
 * The timeline label of the day at a fraction of the way down the list, the last one starting at
 * or above it, but only in the same month; "" when it has none.
 */
export function labelAt(layout: MonthLayout, fraction: number): string {
  const month = markAt(layout.marks, fraction);
  const day = layout.days.findLast((d) => d.at <= fraction);
  return day && month && day.at >= month.at ? day.label : "";
}

/** How far down the list the top of the window is, from 0 to 1. */
export function scrollFraction(layout: MonthLayout, scrollY: number): number {
  return clamp((scrollY - layout.top) / layout.height);
}

/** The page scroll that puts the point a fraction of the way down the list at the top of the window. */
export function scrollFor(layout: MonthLayout, fraction: number): number {
  return layout.top + clamp(fraction) * layout.height;
}

/** The month at a fraction of the way down the list: the last one starting at or above it. */
export function markAt(marks: ScrubberMark[], fraction: number): ScrubberMark | undefined {
  return marks.findLast((mark) => mark.at <= fraction) ?? marks[0];
}

/** The month just before or after the one at a fraction of the way down, for the arrow keys. */
export function neighbourMark(
  marks: ScrubberMark[],
  fraction: number,
  step: 1 | -1,
): ScrubberMark | undefined {
  const current = markAt(marks, fraction);
  const index = current ? marks.indexOf(current) : 0;
  return marks[Math.min(marks.length - 1, Math.max(0, index + step))];
}

/** A group's label on the scrubber, such as a year, at its first mark in the list. */
export interface GroupLabel {
  group: string;
  at: number;
}

/**
 * The groups to label along the scrubber (years, or months when the marks are days, with the
 * year in place of the month at a year's first day), each at its first mark, leaving out any that
 * would sit closer than `gap` pixels to another on a scrubber `trackHeight` tall. Years are placed
 * first, so a busy run of months never crowds out a year.
 */
export function groupLabels(marks: ScrubberMark[], trackHeight: number, gap = 20): GroupLabel[] {
  const years = spaced(levelLabels(marks, 2), [], trackHeight, gap);
  return spaced(levelLabels(marks, 1), years, trackHeight, gap).toSorted((x, y) => x.at - y.at);
}

/** The labels of the marks at one tick level: the year at a year's start, else the group. */
function levelLabels(marks: ScrubberMark[], level: 1 | 2): GroupLabel[] {
  return marks
    .filter((mark) => mark.level === level)
    .map((mark) => ({ group: level === 2 ? mark.year : mark.group, at: mark.at }));
}

/** The labels already placed, plus each new one that sits at least `gap` pixels from all of them. */
function spaced(labels: GroupLabel[], placed: GroupLabel[], trackHeight: number, gap: number) {
  const kept = [...placed];
  for (const label of labels) {
    if (kept.every((other) => Math.abs(label.at - other.at) * trackHeight >= gap)) kept.push(label);
  }
  return kept;
}

/** A number kept between 0 and 1. */
function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
