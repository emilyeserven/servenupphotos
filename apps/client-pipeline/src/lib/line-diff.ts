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
 * The most edits the diff looks for before it gives up on a shortest diff and shows the changed
 * middle as removed, then added. Its memory grows with the square of this, so a file changed all
 * over (such as a regenerated TRIPLINES.geo.json) can't run the browser out of memory.
 */
const MAX_EDITS = 2000;

type Kind = DiffLine["kind"];

/** How many lines from the start, and then from the end, before and after share. */
function commonEnds(before: string[], after: string[]): [number, number] {
  const shorter = Math.min(before.length, after.length);
  let start = 0;
  while (start < shorter && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < shorter - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end++;
  }
  return [start, end];
}

/** Whether diagonal k is reached from k + 1 by adding a line, rather than from k - 1 by removing one. */
function fromAbove(at: (k: number) => number, k: number, d: number): boolean {
  return k === -d || (k !== d && at(k - 1) < at(k + 1));
}

/** How far x gets along diagonal k (y = x - k) while the lines on both sides are equal. */
function slide(before: string[], after: string[], x: number, k: number): number {
  let end = x;
  while (end < before.length && end - k < after.length && before[end] === after[end - k]) end++;
  return end;
}

/**
 * One round of Myers' search: moves each diagonal of v (diagonal k at index k + offset) one more
 * edit along, then down any run of equal lines. True once a diagonal reaches the end of both.
 */
function searchStep(before: string[], after: string[], v: Int32Array, offset: number, d: number) {
  const at = (k: number) => v[offset + k]!;
  for (let k = -d; k <= d; k += 2) {
    const x = slide(before, after, fromAbove(at, k, d) ? at(k + 1) : at(k - 1) + 1, k);
    v[offset + k] = x;
    if (x >= before.length && x - k >= after.length) return true;
  }
  return false;
}

/**
 * Myers' shortest edit search: the furthest point on each diagonal before each round, as one array
 * per edit count (diagonal k at index k + d + 1). Undefined past MAX_EDITS.
 */
function editTrace(before: string[], after: string[]): Int32Array[] | undefined {
  const offset = before.length + after.length + 1;
  const v = new Int32Array(2 * offset + 1);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= Math.min(offset - 1, MAX_EDITS); d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    if (searchStep(before, after, v, offset, d)) return trace;
  }
  return undefined;
}

/** The edits of a shortest diff, from Myers' trace, walked back from the end. */
function editsFromTrace(trace: Int32Array[], n: number, m: number): Kind[] {
  const kinds: Kind[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]!;
    const at = (k: number) => v[k + d + 1]!;
    const k = x - y;
    const prevK = fromAbove(at, k, d) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    for (; x > prevX && y > prevY; x--, y--) kinds.push("same");
    if (d > 0) kinds.push(x === prevX ? "added" : "removed");
    x = prevX;
    y = prevY;
  }
  return kinds.toReversed();
}

/** Each run of changes with its removed lines first, as a unified diff shows them. */
function removedFirst(kinds: Kind[]): Kind[] {
  const out: Kind[] = [];
  let removed = 0;
  let added = 0;
  const flush = () => {
    out.push(...Array<Kind>(removed).fill("removed"), ...Array<Kind>(added).fill("added"));
    removed = 0;
    added = 0;
  };
  for (const kind of kinds) {
    if (kind === "removed") removed++;
    else if (kind === "added") added++;
    else {
      flush();
      out.push(kind);
    }
  }
  flush();
  return out;
}

/** The edits that turn before into after: a shortest diff, or remove all then add all past MAX_EDITS. */
function edits(before: string[], after: string[]): Kind[] {
  const trace = editTrace(before, after);
  if (!trace) {
    return [
      ...Array<Kind>(before.length).fill("removed"),
      ...Array<Kind>(after.length).fill("added"),
    ];
  }
  return removedFirst(editsFromTrace(trace, before.length, after.length));
}

/**
 * The lines that turn `before` into `after`: a shortest diff (Myers' algorithm) of the lines
 * between their shared start and end, so its time and memory grow with the number of changed
 * lines rather than the file's length.
 */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const [start, end] = commonEnds(before, after);
  const lines: DiffLine[] = [];
  for (let index = 0; index < start; index++) lines.push({ kind: "same", index });
  let i = start;
  let j = start;
  for (const kind of edits(
    before.slice(start, before.length - end),
    after.slice(start, after.length - end),
  )) {
    lines.push({ kind, index: kind === "removed" ? i : j });
    if (kind !== "added") i++;
    if (kind !== "removed") j++;
  }
  for (; j < after.length; j++) lines.push({ kind: "same", index: j });
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
