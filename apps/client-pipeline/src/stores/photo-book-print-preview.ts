import { storedValue } from "@portfolio/lib/stored-value";

/** Whether the Book and Layouts tabs preview pages as **PDF for Blurb** prints them, rather than as **Save as PDF** does, kept in this browser. */
export const printPreview = storedValue(
  "pipeline-photo-book-print-preview",
  (stored) => stored === true,
);
