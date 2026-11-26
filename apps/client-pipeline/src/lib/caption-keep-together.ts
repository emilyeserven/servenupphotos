/** A space that a line never breaks at, which keeps the words on each side of it together. */
const NBSP = " ";

/** The word joiner, which keeps a line from breaking after the hyphen it follows. */
const JOINER = "⁠";

/** A **Keep together** mark around a part of a template: `<nobr>…</nobr>`. */
const KEEP_MARK = /<nobr>([\s\S]*?)<\/nobr>/g;

/** A start or end of the mark left over, such as one without the other. */
const LONE_MARK = /<\/?nobr>/g;

/** The text with no place a line could break inside it: its spaces unbreakable, its hyphens joined. */
function glued(text: string): string {
  return text.replaceAll(" ", NBSP).replaceAll("-", `-${JOINER}`);
}

/**
 * The filled caption with its parts kept together on one line: each part in `<nobr>…</nobr>` and
 * each of the values that never break, such as "San Francisco", the marks themselves left out.
 */
export function keepTogether(text: string, noBreak: string[] = []): string {
  let out = text.replace(KEEP_MARK, (_, part: string) => glued(part)).replace(LONE_MARK, "");
  const values = noBreak.map((v) => v.trim()).filter(Boolean);
  for (const value of values.toSorted((a, b) => b.length - a.length)) {
    out = out.replaceAll(value, glued(value));
  }
  return out;
}

/** The text with the spaces and hyphens kept together written plainly again, as a social media post takes it. */
export function unglued(text: string): string {
  return text.replaceAll(NBSP, " ").replaceAll(JOINER, "").replace(LONE_MARK, "");
}
