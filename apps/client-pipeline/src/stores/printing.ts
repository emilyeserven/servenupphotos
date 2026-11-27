import { readPrintChoice } from "@/lib/print-quality";
import { storedValue } from "@portfolio/lib/stored-value";

/** The print size and fit chosen on the Printing pages, kept in this browser. */
export const printChoice = storedValue("pipeline-print-choice", readPrintChoice);

/** The ID of the album used as the print queue, or "" before one is chosen, kept in this browser. */
export const printQueueAlbum = storedValue("pipeline-print-queue-album", (stored) =>
  typeof stored === "string" ? stored : "",
);
