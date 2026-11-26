import { type CaptionValues, placeholderValue } from "@/lib/caption-template";

/** A piece of a place name form as the builder draws it: typed text, or a placeholder's value. */
export type FormToken =
  | { kind: "text"; text: string }
  | { kind: "value"; name: string; value: string }
  | { kind: "section"; tokens: FormToken[]; dropped: boolean };

/** A placeholder in braces, or a part in square brackets. */
const PIECE = /\{([A-Za-z]\w*(?:\|[A-Za-z]\w*)*)\}|\[([^[\]]*)\]/g;

/**
 * A form's text in pieces, each placeholder with its value for the photo, and each square-bracket
 * part marked dropped when a placeholder in it is empty, as filling it in would leave it out.
 */
export function formTokens(text: string, values: CaptionValues): FormToken[] {
  const tokens: FormToken[] = [];
  let from = 0;
  for (const match of text.matchAll(PIECE)) {
    if (match.index > from) tokens.push({ kind: "text", text: text.slice(from, match.index) });
    if (match[1] !== undefined) {
      tokens.push({ kind: "value", name: match[1], value: placeholderValue(match[1], values) });
    } else {
      const inner = formTokens(match[2] ?? "", values);
      const dropped = inner.some((t) => t.kind === "value" && t.value === "");
      tokens.push({ kind: "section", tokens: inner, dropped });
    }
    from = match.index + match[0].length;
  }
  if (from < text.length) tokens.push({ kind: "text", text: text.slice(from) });
  return tokens;
}
