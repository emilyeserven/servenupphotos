import type { Fields } from "@/components/localization-row";

/** What an LLM's answer to the localization prompt says, matched to the names it was asked about. */
export interface LocalizationAnswer {
  /** The fields the answer gives each name asked about, by localization ID. */
  fields: Record<string, Fields>;
  /** IDs the answer gives that weren't asked about, left out. */
  unknown: string[];
}

/** The JSON object in the pasted answer, from its first `{` to its last `}`, so a code block or words around it are fine. */
function answerObject(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The answer has no JSON object in it.");
  try {
    return JSON.parse(answer.slice(start, end + 1));
  } catch {
    throw new Error("The answer's JSON couldn't be read. Check it's the whole answer.");
  }
}

/** The answer's list of localizations, or an error saying it has none. */
function answerEntries(answer: string): unknown[] {
  const entries = (answerObject(answer) as { localizations?: unknown } | null)?.localizations;
  if (!Array.isArray(entries)) throw new Error(`The answer's JSON has no "localizations" list.`);
  return entries;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** One entry of the answer as fields, trimmed, with anything that isn't text read as "". */
function entryFields(entry: Record<string, unknown>): Fields {
  return {
    romanization: text(entry.romanization),
    pronunciation: text(entry.pronunciation),
    localScript: text(entry.localScript),
  };
}

/**
 * Reads the LLM's pasted answer, keeping the fields of each name in `asked` and listing the IDs it
 * gives that weren't asked about. Throws an error a user can read when there's no answer to read.
 */
export function readLocalizationAnswer(answer: string, asked: string[]): LocalizationAnswer {
  const result: LocalizationAnswer = { fields: {}, unknown: [] };
  for (const entry of answerEntries(answer))
    addEntry(result, entry as Record<string, unknown>, asked);
  return result;
}

/** Keeps one entry's fields when it's of a name asked about, or else notes its ID. */
function addEntry(result: LocalizationAnswer, entry: Record<string, unknown>, asked: string[]) {
  const id = text(entry?.id);
  if (asked.includes(id)) result.fields[id] = entryFields(entry);
  else if (id) result.unknown.push(id);
}
