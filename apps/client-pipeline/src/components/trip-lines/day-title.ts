import { format, parseISO } from "date-fns";

/** The day as a heading writes it, such as "Wed, Sep 23, 2026". */
export function dayTitle(day: string): string {
  return format(parseISO(day), "EEE, MMM d, yyyy");
}
