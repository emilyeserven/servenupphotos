import assert from "node:assert/strict";
import { test } from "node:test";
import { type DiffLine, diffLines } from "@/lib/line-diff";

/** The diff as the unified diff would print it: " a", "-b", "+c". */
function render(before: string[], after: string[], lines: DiffLine[]): string[] {
  return lines.map((line) => {
    if (line.kind === "removed") return `-${before[line.index]}`;
    return `${line.kind === "added" ? "+" : " "}${after[line.index]}`;
  });
}

/** Rebuilds both sides from the diff, so every diff can be checked to say exactly what changed. */
function sides(before: string[], after: string[], lines: DiffLine[]) {
  const old = lines.filter((l) => l.kind !== "added");
  const next = lines.filter((l) => l.kind !== "removed");
  return {
    old: old.map((l) => (l.kind === "removed" ? before[l.index] : after[l.index])),
    next: next.map((l) => after[l.index]),
  };
}

test("a changed line is removed, then added, between unchanged ones", () => {
  const before = ["a", "b", "c"];
  const after = ["a", "x", "c"];
  assert.deepEqual(render(before, after, diffLines(before, after)), [" a", "-b", "+x", " c"]);
});

test("added and removed lines take their own sides' indexes", () => {
  const before = ["a", "b", "c", "d"];
  const after = ["b", "c", "e", "d", "f"];
  const lines = diffLines(before, after);
  assert.deepEqual(render(before, after, lines), ["-a", " b", " c", "+e", " d", "+f"]);
  assert.deepEqual(sides(before, after, lines), { old: before, next: after });
});

test("empty sides are all added or all removed", () => {
  assert.deepEqual(diffLines([], ["a", "b"]), [
    { kind: "added", index: 0 },
    { kind: "added", index: 1 },
  ]);
  assert.deepEqual(diffLines(["a"], []), [{ kind: "removed", index: 0 }]);
  assert.deepEqual(diffLines([], []), []);
});

test("random edits give a diff that rebuilds both sides with as few changes as an LCS", () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let round = 0; round < 200; round++) {
    const before = Array.from(
      { length: Math.floor(random() * 12) },
      () => "abc"[Math.floor(random() * 3)]!,
    );
    const after = Array.from(
      { length: Math.floor(random() * 12) },
      () => "abc"[Math.floor(random() * 3)]!,
    );
    const lines = diffLines(before, after);
    assert.deepEqual(sides(before, after, lines), { old: before, next: after });
    const same = lines.filter((l) => l.kind === "same").length;
    assert.equal(same, lcsLength(before, after));
  }
});

test("a long file changed in a few places diffs without a table of every pair of lines", () => {
  const before = Array.from({ length: 50_000 }, (_, i) => `line ${i}`);
  const after = [...before];
  after.splice(20_000, 1, "changed");
  after.splice(40_000, 0, "inserted");
  const lines = diffLines(before, after);
  assert.equal(lines.filter((l) => l.kind === "removed").length, 1);
  assert.equal(lines.filter((l) => l.kind === "added").length, 2);
});

test("a file changed all over falls back to removing and adding its changed middle", () => {
  const before = Array.from({ length: 30_000 }, (_, i) => `old ${i}`);
  const after = Array.from({ length: 30_000 }, (_, i) => `new ${i}`);
  const lines = diffLines(["head", ...before, "tail"], ["head", ...after, "tail"]);
  assert.equal(lines.length, 60_002);
  assert.deepEqual(lines[0], { kind: "same", index: 0 });
  assert.deepEqual(lines[1], { kind: "removed", index: 1 });
  assert.deepEqual(lines[30_001], { kind: "added", index: 1 });
  assert.deepEqual(lines.at(-1), { kind: "same", index: 30_001 });
});

function lcsLength(a: string[], b: string[]): number {
  const row = Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = x === b[j - 1] ? diagonal + 1 : Math.max(row[j]!, row[j - 1]!);
      diagonal = above;
    }
  }
  return row[b.length]!;
}
