/** The photos hearted on Print Queue as the ones to actually print, as saved: file names, each once. */
export function readPicks(stored: unknown): string[] {
  if (!Array.isArray(stored)) return [];
  return [...new Set(stored.filter((key): key is string => typeof key === "string" && key !== ""))];
}

/** The picks with the photo's file name added, or taken out when it's already hearted. */
export function togglePick(picks: readonly string[], key: string): string[] {
  return picks.includes(key) ? picks.filter((k) => k !== key) : [...picks, key];
}
