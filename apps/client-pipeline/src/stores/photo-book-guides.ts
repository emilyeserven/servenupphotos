import { storedValue } from "@portfolio/lib/stored-value";

/** Whether the Book and Layouts tabs draw Blurb's bleed and safe boundary over each page, kept in this browser. */
export const printGuides = storedValue(
  "pipeline-photo-book-print-guides",
  (stored) => stored === true,
);
