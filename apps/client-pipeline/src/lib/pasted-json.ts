/** Curly double quotes (“ ”), which text copied from a chat app often has in place of straight ones. */
const CURLY_DOUBLE_QUOTES = /[“”]/g;

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
