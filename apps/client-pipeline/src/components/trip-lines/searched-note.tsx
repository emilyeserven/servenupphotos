import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { type HopAsk, type LookupSource, transitSearchedQuery } from "@/api/transit";

interface SearchedNoteProps {
  /** What the lines look-up asked, and where; none while it can't ask. */
  ask?: HopAsk;
  source: LookupSource;
  /** Whether lines are being looked for, and the look-up's state. */
  finding: boolean;
  lines: { isSuccess: boolean; isFetching: boolean };
}

/**
 * What the last lines look-up searched, as the backend says it, such as "OpenStreetMap's bus map
 * of South Korea (4210 bus routes, …): 12 pass within 500 m of the first end and 0 within 500 m of
 * the last", so a look-up that finds nothing says where it looked and how close it came. When the
 * backend didn't say, as one started before this was added doesn't, it says to restart it.
 */
export function SearchedNote({ ask, source, finding, lines }: SearchedNoteProps) {
  const { data } = useQuery(transitSearchedQuery(ask, source));
  if (!answered(finding, lines) || data === undefined) return null;
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
      <Search aria-hidden className="mt-0.5 size-3 shrink-0" />
      <span>{data ? `Searched ${data}.` : OLD_BACKEND}</span>
    </p>
  );
}

/** Whether the look-up being shown has answered, so there's something to say. */
function answered(finding: boolean, lines: SearchedNoteProps["lines"]): boolean {
  return finding && lines.isSuccess && !lines.isFetching;
}

/** Said when the backend's answer didn't say what it searched. */
const OLD_BACKEND =
  "The backend didn't say what it searched, so it may have been started before the bus map was added and looked on OpenStreetMap's servers instead. Restart it (pnpm dev:pipeline) and look again.";
