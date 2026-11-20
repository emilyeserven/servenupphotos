/** Curly double quotes (“ ”), which text copied from a chat app often has in place of straight ones. */
const CURLY_DOUBLE_QUOTES = /[“”]/g;

/**
 * What every answer box says when the pasted text has no JSON object that can be read. The Go
 * backend's `parseLLMAnswer` says the same.
 */
export const UNREADABLE_ANSWER =
  "The answer has no JSON object that can be read. Paste the LLM's whole answer, from { to }, or ask it to answer with only the JSON.";

/**
 * text read as JSON, as pasted into an answer box. When it doesn't read as it is, it's read again with every
 * curly double quote (“ ”) made straight ("), since an answer copied from a chat app often has them around its
 * keys and values. Curly single quotes (‘ ’) stay as they are, as words inside the values use them. When neither
 * reads, it throws the error from reading the text as it was pasted.
 */
export function parsePastedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const straight = text.replace(CURLY_DOUBLE_QUOTES, '"');
    if (straight === text) throw error;
    try {
      return JSON.parse(straight);
    } catch {
      throw error;
    }
  }
}

/**
 * The JSON object in a pasted LLM answer, read from its first `{` to its last `}` so a code block or
 * words around it are fine, with curly double quotes read as straight ones (`parsePastedJson`).
 * Every answer box reads its text with this. Throws `UNREADABLE_ANSWER` when there's no object to
 * read.
 */
export function readPastedObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(UNREADABLE_ANSWER);
  let value: unknown;
  try {
    value = parsePastedJson(text.slice(start, end + 1));
  } catch {
    throw new Error(UNREADABLE_ANSWER);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(UNREADABLE_ANSWER);
  }
  return value as Record<string, unknown>;
}

/**
 * The list under `key` in a pasted LLM answer's JSON object, such as its "photos". Throws a
 * sentence a user can read when there's no object, or it has no such list.
 */
export function readPastedList(text: string, key: string): unknown[] {
  const list = readPastedObject(text)[key];
  if (!Array.isArray(list)) throw new Error(`The answer's JSON has no "${key}" list.`);
  return list;
}

/** Quotes, straight or curly, that an answer sometimes leaves around a name. */
const QUOTES_AROUND = /^["'“”‘’]+|["'“”‘’]+$/g;

/**
 * A name as an LLM's answer gave it, made ready for matching to a photo: trimmed, without quotes
 * around it or a `.json` ending, in lower case. So `"IMG_1.JSON"` matches the photo `img_1`. Every
 * lookup of a photo by a name in a pasted answer goes through it; Go's `matchName` does the same.
 */
export function matchName(name: string): string {
  return name
    .trim()
    .replace(QUOTES_AROUND, "")
    .trim()
    .replace(/\.json$/i, "")
    .toLowerCase();
}

/**
 * Looks things up by a name in a pasted answer, matching each by every name `names` gives it (such
 * as a photo's JSON file name and its original file's name) with `matchName`.
 */
export function nameFinder<T>(
  items: Iterable<T>,
  names: (item: T) => string[],
): (name: string) => T | undefined {
  const byName = new Map<string, T>();
  for (const item of items) {
    for (const name of names(item)) {
      const key = matchName(name);
      if (key && !byName.has(key)) byName.set(key, item);
    }
  }
  return (name) => byName.get(matchName(name));
}

/** What reviewing an answer box came to: the answer read, or the error saying why it couldn't be. */
export type AnswerOutcome<T> = { answer: T; error: null } | { answer: null; error: Error };

/**
 * Reads typed, an answer box's text, with read, which reads it in the browser or asks the backend,
 * and settles on the answer or the error saying why it couldn't be read. `usePastedAnswer` reviews
 * with it.
 */
export async function settleAnswer<T>(
  read: (typed: string) => T | Promise<T>,
  typed: string,
): Promise<AnswerOutcome<T>> {
  try {
    return { answer: await read(typed), error: null };
  } catch (problem) {
    return { answer: null, error: problem instanceof Error ? problem : new Error(String(problem)) };
  }
}

/** Whether an answer box's review button can be pressed: it has text, and nothing is waiting. */
export function canReview(typed: string, waiting: boolean): boolean {
  return typed.trim() !== "" && !waiting;
}
