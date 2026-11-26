import { unglued } from "@/lib/caption-keep-together";

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

/** The mark a Space above button writes: a self-closing tag giving its line a quarter line of room above it. */
const GAP = "<gap />";

/** Any way of writing the space-above mark: `<gap />`, `<gap/>`, or `<gap>` as older templates have it. */
const GAP_MARK = /<gap\s*\/?>/g;

/** The caption without its style marks, as a social media post takes it. */
export function plainCaption(text: string): string {
  return unglued(text.replace(MARK, "").replace(GAP_MARK, ""));
}

/** One line of a caption as it's drawn. */
export interface CaptionLine {
  /** Its stretches of text, without the marks. */
  runs: CaptionRun[];
  /** Every stretch of it is smaller, so the whole line is, with its line height to match. */
  small: boolean;
  /** It has `<gap />` in it, for a quarter line of room above it. */
  gap: boolean;
}

/** A line's stretches without `<gap />`, whether it had one, and whether it's all smaller. */
function finishLine(runs: CaptionRun[]): CaptionLine {
  const gap = runs.some((r) => r.text.search(GAP_MARK) >= 0);
  const kept = runs
    .map((r) => ({ ...r, text: r.text.replace(GAP_MARK, "") }))
    .filter((r) => r.text);
  const small = kept.length > 0 && kept.every((r) => r.small);
  return { gap, small, runs: small ? kept.map((r) => ({ ...r, small: false })) : kept };
}

/**
 * The caption's lines, each with its stretches of styled text. A line that's smaller all through is
 * marked small as a whole, its stretches not, so it's drawn smaller with a line height to match
 * instead of keeping the larger text's.
 */
export function captionLines(text: string): CaptionLine[] {
  const lines: CaptionRun[][] = [[]];
  for (const run of captionRuns(text)) {
    run.text.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines.at(-1)?.push({ ...run, text: part });
    });
  }
  return lines.map(finishLine);
}

/** The Tailwind classes that draw a line: a block, smaller all through, with a quarter line above. */
export function lineClass(line: CaptionLine): string {
  return ["block", line.small && "text-[0.8em]", line.gap && "mt-[0.25lh]"]
    .filter(Boolean)
    .join(" ");
}

/** The text with `<gap />` put at the start of the line the cursor is on, or of the last line. */
export function withGap(text: string, at: Selection | null): string {
  const cursor = at?.selectionStart ?? text.length;
  const start = text.lastIndexOf("\n", cursor - 1) + 1;
  return `${text.slice(0, start)}${GAP}${text.slice(start)}`;
}

/** Where a text box's selection starts and ends; null or missing when it isn't known. */
export interface Selection {
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

/** The marks a button puts around the selected text: smaller, italics, or kept together on one line. */
export type TextMark = "small" | "i" | "nobr";

/**
 * The text with the selection put inside the mark, such as `i` for `<i>…</i>`; with nothing
 * selected, an empty pair at the cursor, or at the end when there's no cursor.
 */
export function withMark(text: string, at: Selection | null, mark: TextMark): string {
  const start = at?.selectionStart ?? text.length;
  const end = at?.selectionEnd ?? start;
  return `${text.slice(0, start)}<${mark}>${text.slice(start, end)}</${mark}>${text.slice(end)}`;
}

/** The Tailwind classes that draw a run: smaller at 80%, in italics, both, or none. */
export function runClass(run: CaptionRun): string | undefined {
  const classes = [run.small && "text-[0.8em]", run.italic && "italic"].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
}
