/** A lens whose name a book's captions write without the words it starts with. */
export interface LensPrefix {
  /** The lens's name as the photo's data has it, after camera and lens overrides. */
  lens: string;
  /** What the captions leave off the start of its name, such as "Fujinon ". */
  prefix: string;
}

/** The lens's name as the book's captions write it: without its prefix, when it starts with it. */
export function stripLensPrefix(lens: string, prefixes: LensPrefix[] | undefined): string {
  const prefix = prefixes?.find((p) => p.lens === lens)?.prefix;
  if (!prefix || !lens.startsWith(prefix)) return lens;
  return lens.slice(prefix.length).trimStart();
}

/** The book's prefixes with lens's set to prefix, or taken off when prefix is empty. */
export function withLensPrefix(
  prefixes: LensPrefix[] | undefined,
  lens: string,
  prefix: string,
): LensPrefix[] {
  const others = (prefixes ?? []).filter((p) => p.lens !== lens);
  return prefix === "" ? others : [...others, { lens, prefix }];
}

/**
 * Each name (a lens or a camera) once, with how many of the names are it, the most first, then by
 * name.
 */
export function nameCounts(names: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The photo's fields with its lens written as the book's captions write it. */
export function withStrippedLens(
  fields: Record<string, unknown>,
  prefixes: LensPrefix[] | undefined,
): Record<string, unknown> {
  if (typeof fields.lens !== "string") return fields;
  return { ...fields, lens: stripLensPrefix(fields.lens, prefixes) || fields.lens };
}

/** What the Info tab says beside a lens: how the book's captions write it with its prefix. */
export function prefixNote(lens: string, prefixes: LensPrefix[] | undefined): string {
  const prefix = prefixes?.find((p) => p.lens === lens)?.prefix ?? "";
  if (prefix === "") return "Written as it is";
  const stripped = stripLensPrefix(lens, prefixes);
  return stripped === lens ? "Doesn't start with that" : `Captions say ${stripped}`;
}
