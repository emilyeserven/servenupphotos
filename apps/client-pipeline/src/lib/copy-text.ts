/**
 * True on a phone or tablet: a touch screen with no mouse. There, outside a secure context, the
 * older copy command can answer that it copied when nothing reached the clipboard (iOS Safari), so
 * the text is shown in the modal instead.
 */
export function isTouchOnly(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Copies text to the clipboard, and says whether it could. The Clipboard API only works on HTTPS
 * or localhost, so on a plain HTTP address (such as the pipeline on a Raspberry Pi over Tailscale)
 * it falls back to the older `document.execCommand("copy")` on a hidden text box, except on a
 * phone or tablet, where that can't be trusted. When it can't copy it answers false, and the caller
 * shows the text for copying by hand.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Blocked by the browser: try the older way below.
    }
  }
  return copyWithHiddenTextarea(text);
}

/** Copies text from a hidden text box with the browser's copy command, or answers false on a phone. */
function copyWithHiddenTextarea(text: string): boolean {
  if (isTouchOnly()) return false;
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.append(box);
  try {
    return copyFromBox(box);
  } finally {
    box.remove();
  }
}

/**
 * Selects all of a text box's text and runs the browser's copy command on it, saying whether the
 * browser says it copied. `setSelectionRange` selects it on iOS too, where `select()` on a
 * read-only box selects nothing.
 */
export function copyFromBox(box: HTMLTextAreaElement): boolean {
  selectAll(box);
  try {
    // execCommand is deprecated, but it is the only way to copy outside a secure context.
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

/** Selects all of a text box's text, in every browser (iOS ignores `select()` on a read-only box). */
export function selectAll(box: HTMLTextAreaElement): void {
  box.focus();
  box.select();
  box.setSelectionRange(0, box.value.length);
}
