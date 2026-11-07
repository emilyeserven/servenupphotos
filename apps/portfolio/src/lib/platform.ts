/** Whether the browser runs on a Mac, iPhone or iPad, where shortcuts use ⌘ rather than Ctrl. */
function isApple(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** The key held to change what a click does: ⌘ on Apple devices, Ctrl everywhere else. */
export function modifierKey(): string {
  return isApple() ? "⌘" : "Ctrl";
}
