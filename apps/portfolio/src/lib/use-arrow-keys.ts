import { useEffect } from "react";

/** Whether the key press is typing in a field, which keeps its arrow keys. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return target?.closest("input, textarea, select, [contenteditable]") != null;
}

/** Whether a modifier key is held, making the press a shortcut. */
function isShortcut({ altKey, ctrlKey, metaKey }: KeyboardEvent): boolean {
  return altKey || ctrlKey || metaKey;
}

/** Whether the key press belongs to something else: a field being typed in, or a shortcut. */
function isForSomethingElse(event: KeyboardEvent): boolean {
  return event.defaultPrevented || isShortcut(event) || isTyping(event);
}

/** Calls onStep with -1 for the left arrow key and 1 for the right one, pressed anywhere on the page. */
export function useArrowKeys(onStep: (by: number) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (by === undefined || isForSomethingElse(event)) return;
      event.preventDefault();
      onStep(by);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStep]);
}
