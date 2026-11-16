import { arrowStep, type StepKey } from "@/lib/social-feed";

/** What a key pressed in a compare group's full-size view does. */
export type CompareKeyAction =
  | { kind: "step"; step: number }
  | { kind: "winner" }
  | { kind: "lowerTier" }
  | null;

/** The key that picks or unpicks the photo shown as a winner. */
export const WINNER_KEY = "W";
/** The key that marks the photo shown Lower Tier, or takes the mark off. */
export const LOWER_TIER_KEY = "L";

/**
 * What a key press does in a compare group's full-size view: ← and → move to the previous or next
 * photo, W picks or unpicks the winner and L flips Lower Tier. Keys with Ctrl, Alt or ⌘ do nothing,
 * so the browser's own shortcuts still work.
 */
export function compareKeyAction(event: StepKey): CompareKeyAction {
  const step = arrowStep(event);
  if (step !== 0) return { kind: "step", step };
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const key = event.key.toUpperCase();
  if (key === WINNER_KEY) return { kind: "winner" };
  if (key === LOWER_TIER_KEY) return { kind: "lowerTier" };
  return null;
}

/**
 * The path step places from current in paths, going round from the last to the first and back,
 * or current itself when it isn't in paths.
 */
export function steppedPath(paths: string[], current: string, step: number): string {
  const index = paths.indexOf(current);
  if (index < 0 || paths.length === 0) return current;
  return paths[(index + step + paths.length) % paths.length] ?? current;
}

/** A button's title with its key in brackets, such as "Unpick it (W)", or the title alone without one. */
export function withShortcut(title: string, shortcut: string | undefined): string {
  return shortcut ? `${title} (${shortcut})` : title;
}
