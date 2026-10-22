/**
 * One line of a line diff: kept from both sides, or only on the old or new side. index is the
 * line's index in the old lines when it's removed, and in the new lines otherwise.
 */
export interface DiffLine {
  kind: "same" | "removed" | "added";
  index: number;
}

/** A diff line, or a run of unchanged lines folded away between hunks. */
export type DiffRow = DiffLine | { kind: "folded"; count: number };

/**
 * The length of the longest common subsequence of before[i:] and after[j:], or -1 past either end,
 * so a finished side always loses to the other.
 */
function lcsTable(before: string[], after: string[]): (i: number, j: number) => number {
  const width = after.length + 1;
  const lengths = new Uint32Array((before.length + 1) * width);
  const lcs = (i: number, j: number) =>
    i > before.length || j > after.length ? -1 : (lengths[i * width + j] ?? 0);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        before[i] === after[j] ? lcs(i + 1, j + 1) + 1 : Math.max(lcs(i + 1, j), lcs(i, j + 1));
    }
  }
  return lcs;
}

/** What the diff does at before[i] and after[j]: removing first, as a unified diff does. */
function nextKind(
  before: string[],
  after: string[],
  i: number,
  j: number,
  lcs: (i: number, j: number) => number,
): DiffLine["kind"] {
  if (i < before.length && before[i] === after[j]) return "same";
  return lcs(i + 1, j) >= lcs(i, j + 1) ? "removed" : "added";
}

// How far each kind moves along the old and new lines.
const STEPS = { same: [1, 1], removed: [1, 0], added: [0, 1] } as const;

/** The lines that turn `before` into `after`, by their longest common subsequence. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const lcs = lcsTable(before, after);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  // Neither side moves past its end, so this ends when both are done.
  while (i + j < before.length + after.length) {
    const kind = nextKind(before, after, i, j, lcs);
    lines.push({ kind, index: kind === "removed" ? i : j });
    i += STEPS[kind][0];
    j += STEPS[kind][1];
  }
  return lines;
}

/** `lines` with unchanged runs more than `context` lines from a change folded away. */
export function foldUnchanged(lines: DiffLine[], context = 3): DiffRow[] {
  const changed = lines.map((line) => line.kind !== "same");
  const rows: DiffRow[] = [];
  let folded = 0;
  lines.forEach((line, index) => {
    if (!changed.slice(Math.max(0, index - context), index + context + 1).some(Boolean)) {
      folded++;
      return;
    }
    if (folded > 0) rows.push({ kind: "folded", count: folded });
    folded = 0;
    rows.push(line);
  });
  if (folded > 0) rows.push({ kind: "folded", count: folded });
  return rows;
}
