/** A month's place on the Timeline's scrubber: its heading, and how far down the list it starts, from 0 to 1. */
export interface ScrubberMark {
  month: string;
  at: number;
}

/** Where the list of months sits on the page, and where each month starts in it. */
export interface MonthLayout {
  /** The list's top, in pixels from the top of the page. */
  top: number;
  /** The list's height in pixels. */
  height: number;
  marks: ScrubberMark[];
}

/** Measures the list of months, whose sections carry their heading in `data-month`. */
export function measureMonths(list: HTMLElement): MonthLayout {
  const listBox = list.getBoundingClientRect();
  const height = Math.max(1, listBox.height);
  const sections = list.querySelectorAll<HTMLElement>(":scope > [data-month]");
  const marks = [...sections].map((section) => ({
    month: section.dataset.month ?? "",
    at: (section.getBoundingClientRect().top - listBox.top) / height,
  }));
  return { top: listBox.top + window.scrollY, height, marks };
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

/** A year's label on the scrubber, at its first month in the list. */
export interface YearLabel {
  year: string;
  at: number;
}

/**
 * The years to label along the scrubber, each at its first month in the list, leaving out any
 * that would sit closer than `gap` pixels to the one above on a scrubber `trackHeight` tall.
 */
export function yearLabels(marks: ScrubberMark[], trackHeight: number, gap = 20): YearLabel[] {
  const labels: YearLabel[] = [];
  for (const label of firstOfEachYear(marks)) {
    const last = labels.at(-1);
    if (!last || (label.at - last.at) * trackHeight >= gap) labels.push(label);
  }
  return labels;
}

/** Each year's first month in the list, in order. */
function firstOfEachYear(marks: ScrubberMark[]): YearLabel[] {
  const years = new Map<string, number>();
  for (const mark of marks) {
    const year = mark.month.slice(-4);
    if (!years.has(year)) years.set(year, mark.at);
  }
  return [...years].map(([year, at]) => ({ year, at }));
}

/** A number kept between 0 and 1. */
function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
