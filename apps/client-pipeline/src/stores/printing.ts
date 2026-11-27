import { readPicks } from "@/lib/print-picks";
import { readPrintChoice } from "@/lib/print-quality";
import { storedValue } from "@portfolio/lib/stored-value";

/** The print size and fit chosen on the Printing pages, kept in this browser. */
export const printChoice = storedValue("pipeline-print-choice", readPrintChoice);

/** The ID of the album used as the print queue, or "" before one is chosen, kept in this browser. */
export const printQueueAlbum = storedValue("pipeline-print-queue-album", (stored) =>
  typeof stored === "string" ? stored : "",
);

/**
 * The lowest pixels per inch a print queue photo should print at, or 0 for none; photos below it are
 * grayed out on Print Queue. Kept in this browser.
 */
export const printMinPpi = storedValue("pipeline-print-min-ppi", (stored) =>
  typeof stored === "number" && stored > 0 ? stored : 0,
);

/**
 * The print queue photos hearted as the ones to actually print, by file name. Kept in this browser,
 * like the queue album itself.
 */
export const printPicks = storedValue("pipeline-print-picks", readPicks);
