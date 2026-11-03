/**
 * A month's or a day's place on the Timeline's scrubber: its heading, the group it's labeled
 * under along the scrubber (a month's year, or a day's month), and how far down the list it
 * starts, from 0 to 1.
 */
export interface ScrubberMark {
  month: string;
  group: string;
  at: number;
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
 * them (`data-day`), each with its group in `data-group`. `byDay` makes each day a mark instead of
 * each month.
 */
export function measureMonths(list: HTMLElement, byDay = false): MonthLayout {
  const listBox = list.getBoundingClientRect();
  const height = Math.max(1, listBox.height);
  const sections = list.querySelectorAll<HTMLElement>(
    byDay ? "[data-day]" : ":scope > [data-month]",
  );
  const at = (element: HTMLElement) => (element.getBoundingClientRect().top - listBox.top) / height;
  const marks = [...sections].map((section) => ({
    month: (byDay ? section.dataset.day : section.dataset.month) ?? "",
    group: section.dataset.group ?? "",
    at: at(section),
  }));
  const days = [...list.querySelectorAll<HTMLElement>("[data-day]")].map((day) => ({
    label: day.dataset.label ?? "",
    at: at(day),
  }));
  return { top: listBox.top + window.scrollY, height, marks, days };
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
 * The groups to label along the scrubber (years, or months when the marks are days), each at its
 * first mark in the list, leaving out any that would sit closer than `gap` pixels to the one
 * above on a scrubber `trackHeight` tall.
 */
export function groupLabels(marks: ScrubberMark[], trackHeight: number, gap = 20): GroupLabel[] {
  const labels: GroupLabel[] = [];
  for (const label of firstOfEachGroup(marks)) {
    const last = labels.at(-1);
    if (!last || (label.at - last.at) * trackHeight >= gap) labels.push(label);
  }
  return labels;
}

/** Each group's first mark in the list, in order. */
function firstOfEachGroup(marks: ScrubberMark[]): GroupLabel[] {
  const groups = new Map<string, number>();
  for (const mark of marks) {
    if (!groups.has(mark.group)) groups.set(mark.group, mark.at);
  }
  return [...groups].map(([group, at]) => ({ group, at }));
}

/** A number kept between 0 and 1. */
function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
