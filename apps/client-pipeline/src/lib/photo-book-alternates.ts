import type { PhotoBook } from "@/lib/photo-book";
import { type BookUnit, bookOrder, bookUnits, changePages } from "@/lib/photo-book-order";

/** The alternates group the page or spread is in; undefined for none. */
export function alternatesOf(unit: BookUnit): string | undefined {
  return unit.pages[0]?.alternates || undefined;
}

/** Whether the page or spread is an alternate that lost to the one picked, so it's hidden. */
export function isHidden(unit: BookUnit): boolean {
  return unit.pages.some((page) => page.hidden);
}

/** The pages and spreads in the group, in their order. */
function groupUnits(book: PhotoBook, group: string): BookUnit[] {
  return bookUnits(book).filter((unit) => alternatesOf(unit) === group);
}

/** The page or spread with ID id and its alternates group; null when it's in none. */
function inGroup(book: PhotoBook, id: string): { unit: BookUnit; group: string } | null {
  const unit = bookUnits(book).find((u) => u.id === id);
  const group = unit && alternatesOf(unit);
  return unit && group ? { unit, group } : null;
}

/** The pages and spreads in the same alternates group as unit, it too; none when it's in no group. */
export function groupMembers(book: PhotoBook, unit: BookUnit): BookUnit[] {
  const group = alternatesOf(unit);
  return group ? groupUnits(book, group) : [];
}

/**
 * What a page or spread's Alternates button says: "Alternates", or its group's letter, such as
 * "Alternate A", with " · hidden" on one that lost to the one picked.
 */
export function alternatesLabel(book: PhotoBook, unit: BookUnit): string {
  const group = alternatesOf(unit);
  const letter = group && alternateLetters(book).get(group);
  if (!letter) return "Alternates";
  return `Alternate ${letter}${isHidden(unit) ? " · hidden" : ""}`;
}

/** The IDs of the pages of units. */
function pageIds(units: BookUnit[]): Set<string> {
  return new Set(units.flatMap((unit) => unit.pages.map((page) => page.id)));
}

/** Each alternates group's letter, A first, in the order the groups first come among the pages. */
export function alternateLetters(book: PhotoBook): Map<string, string> {
  const letters = new Map<string, string>();
  for (const unit of bookUnits(book)) {
    const group = alternatesOf(unit);
    if (group && !letters.has(group)) {
      letters.set(group, String.fromCharCode(65 + (letters.size % 26)));
    }
  }
  return letters;
}

/** A group name no page has yet: alt-1, alt-2, … */
function newGroup(book: PhotoBook): string {
  const taken = new Set(book.pages.map((page) => page.alternates));
  let n = 1;
  while (taken.has(`alt-${n}`)) n += 1;
  return `alt-${n}`;
}

/**
 * The book with the pages or spreads with IDs id and other made alternates of each other: other
 * joins id's group (and brings its own group with it), or both start a new one.
 */
export function markAlternate(book: PhotoBook, id: string, other: string): PhotoBook {
  return markAlternates(book, [id, other]);
}

/**
 * The book with the pages or spreads with the IDs made alternates of each other, in one group: the
 * first one's group, or the first group among them, or a new one. Groups they were in come along
 * whole. Fewer than two that exist changes nothing.
 */
export function markAlternates(book: PhotoBook, ids: string[]): PhotoBook {
  const units = bookUnits(book);
  const chosen = ids.flatMap((id) => units.filter((unit) => unit.id === id));
  if (new Set(chosen).size < 2) return book;
  const groups = new Set(chosen.map(alternatesOf).filter((g) => g !== undefined));
  const group = groups.values().next().value ?? newGroup(book);
  const joining = units.filter(
    (unit) => chosen.includes(unit) || groups.has(alternatesOf(unit) ?? "-"),
  );
  return changePages(book, pageIds(joining), (page) => ({ ...page, alternates: group }));
}

/**
 * The book with the page or spread with ID id out of its alternates group, shown again. A group
 * left with one page or spread is no group, so that one leaves it too.
 */
export function leaveAlternates(book: PhotoBook, id: string): PhotoBook {
  const found = inGroup(book, id);
  if (!found) return book;
  const { unit, group } = found;
  const rest = groupUnits(book, group).filter((u) => u.id !== unit.id);
  const leaving = rest.length === 1 ? [unit, ...rest] : [unit];
  return changePages(book, pageIds(leaving), ({ alternates: _a, hidden: _h, ...page }) => page);
}

/**
 * The book with the page or spread with ID id picked from its alternates group: the others are
 * hidden, kept for later. In the book, it takes the place of the first of its group there, and
 * the others come out.
 */
export function pickAlternate(book: PhotoBook, id: string): PhotoBook {
  const found = inGroup(book, id);
  if (!found) return book;
  const { unit, group } = found;
  const members = groupUnits(book, group);
  const ids = new Set(members.map((u) => u.id));
  const order = bookOrder(book);
  const at = order.findIndex((other) => ids.has(other));
  const kept = order.filter((other) => !ids.has(other));
  if (at >= 0) kept.splice(at, 0, unit.id);
  const winner = pageIds([unit]);
  const changed = changePages(book, pageIds(members), (page) => ({
    ...page,
    hidden: !winner.has(page.id),
  }));
  return { ...changed, order: kept };
}

/** The book with every page and spread in the group shown again, none picked. */
export function showAlternates(book: PhotoBook, group: string): PhotoBook {
  return changePages(book, pageIds(groupUnits(book, group)), ({ hidden: _h, ...page }) => page);
}
