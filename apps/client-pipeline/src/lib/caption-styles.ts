/** One stretch of a caption's text, with the styles marked around it. */
export interface CaptionRun {
  text: string;
  /** Inside `<small>…</small>`: drawn smaller. */
  small: boolean;
  /** Inside `<i>…</i>`: drawn in italics. */
  italic: boolean;
}

/** The style marks a caption template can put around text: `<small>` and `<i>`, and their ends. */
const MARK = /<(\/?)(small|i)>/g;

/**
 * The text split where its style marks start and end, each stretch with the styles it's inside,
 * the marks themselves left out. Marks nest, so `<small><i>…</i></small>` is both; an end without
 * a start does nothing, and a start without an end lasts to the end of the text.
 */
export function captionRuns(text: string): CaptionRun[] {
  const depth = { small: 0, i: 0 };
  const runs: CaptionRun[] = [];
  let from = 0;
  const push = (to: number) => {
    if (to > from) {
      runs.push({ text: text.slice(from, to), small: depth.small > 0, italic: depth.i > 0 });
    }
  };
  for (const match of text.matchAll(MARK)) {
    push(match.index);
    const mark = match[2] as "small" | "i";
    depth[mark] = Math.max(0, depth[mark] + (match[1] ? -1 : 1));
    from = match.index + match[0].length;
  }
  push(text.length);
  return runs;
}

/** The caption without its style marks, as a social media post takes it. */
export function plainCaption(text: string): string {
  return text.replace(MARK, "");
}

/** Where a text box's selection starts and ends; null or missing when it isn't known. */
export interface Selection {
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

/**
 * The text with the selection put inside the mark, such as `i` for `<i>…</i>`; with nothing
 * selected, an empty pair at the cursor, or at the end when there's no cursor.
 */
export function withMark(text: string, at: Selection | null, mark: "small" | "i"): string {
  const start = at?.selectionStart ?? text.length;
  const end = at?.selectionEnd ?? start;
  return `${text.slice(0, start)}<${mark}>${text.slice(start, end)}</${mark}>${text.slice(end)}`;
}

/** The Tailwind classes that draw a run: smaller at 80%, in italics, both, or none. */
export function runClass(run: CaptionRun): string | undefined {
  const classes = [run.small && "text-[0.8em]", run.italic && "italic"].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
}
