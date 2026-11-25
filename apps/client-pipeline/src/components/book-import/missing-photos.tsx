import { SectionTitle } from "@/components/section-title";
import type { MissingPhoto } from "@/lib/book-import";

/** The book's photos that aren't on the website, each with its page and what it shows. */
export function MissingPhotos({ missing }: { missing: MissingPhoto[] }) {
  if (missing.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>Not on the website</SectionTitle>
      <ul className="list-disc space-y-0.5 ps-5">
        {missing.map((photo, i) => (
          <li key={`${photo.page}-${i}`}>{missingText(photo)}</li>
        ))}
      </ul>
    </div>
  );
}

/** "Page 4: Snowy Park. A snowy path by the river.", leaving out what the answer didn't say. */
function missingText({ page, printedTitle, description }: MissingPhoto): string {
  const what = [printedTitle, description].filter(Boolean).join(". ");
  return page === null ? what : `Page ${page}: ${what}`;
}
