/**
 * Copies text to the clipboard, and says whether it could. The Clipboard API only works on HTTPS
 * or localhost, so on a plain HTTP address (such as the pipeline on a Raspberry Pi over Tailscale)
 * it falls back to the older `document.execCommand("copy")` on a hidden text box. When both fail
 * it answers false, and the caller shows the text for copying by hand.
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

/** Copies text by selecting it in a hidden text box and running the browser's copy command. */
function copyWithHiddenTextarea(text: string): boolean {
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.append(box);
  box.select();
  try {
    // execCommand is deprecated, but it is the only way to copy outside a secure context.
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    box.remove();
  }
}
