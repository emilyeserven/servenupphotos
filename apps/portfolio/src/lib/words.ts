/**
 * A count with its noun, such as "1 photo", "3 photos" or "1,204 photos". Pass the plural when
 * adding "s" isn't right, such as `count(n, "person", "people")`. Every "1 photo, 2 photos" in the
 * portfolio and the pipeline goes through here instead of writing `=== 1 ?` (`.claude/rules/counting-words.md`).
 */
export function count(n: number, noun: string, plural = `${noun}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? noun : plural}`;
}
