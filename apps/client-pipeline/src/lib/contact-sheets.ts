import type { ContactSheet } from "@/api/contact-sheets";

/**
 * The sheet the photo listed at `index` (from 0) is on, and its tile number, or undefined without
 * sheets or when no sheet has it.
 */
function tileOf(sheets: ContactSheet[] | undefined, index: number) {
  const number = index + 1;
  const at = sheets?.findIndex((sheet) => sheet.first <= number && number <= sheet.last) ?? -1;
  return at === -1 ? undefined : { sheet: at + 1, number };
}

/**
 * What a photo's line in a prompt adds after its name to say where it is on the contact sheets,
 * such as ` (tile 12 on contact sheet 1)`, or "" without sheets.
 */
export function tileNote(sheets: ContactSheet[] | undefined, index: number): string {
  const tile = tileOf(sheets, index);
  return tile ? ` (tile ${tile.number} on contact sheet ${tile.sheet})` : "";
}

/**
 * How the prompt asks the LLM to look at the photos: with contact sheets, look through the sheets
 * first and open a photo's own link only for a closer look; without them, `withoutSheets`.
 */
export function lookAtPhotos(sheets: ContactSheet[] | undefined, withoutSheets: string): string {
  if (!sheets || sheets.length === 0) return withoutSheets;
  const lines = sheets.map(
    (sheet, i) => `- Contact sheet ${i + 1} (tiles ${sheet.first} to ${sheet.last}): ${sheet.url}`,
  );
  return `Start with the contact sheets below. Each shows up to 30 of these photos as numbered tiles, in the order they're listed here, each labeled with its tile number and the photo's name in quotes. Open every sheet and look at the photos on it. Each photo's own link is a larger version: open it only when you need a closer look, such as to tell two similar photos apart or to read a sign.
${lines.join("\n")}`;
}
