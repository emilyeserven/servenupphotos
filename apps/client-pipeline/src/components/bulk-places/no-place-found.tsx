import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNoPlaceFoundStore } from "@/stores/no-place-found";
import { count } from "@portfolio/lib/words";

/**
 * Says how many photos without places Bulk Places left out because an LLM found no place for them,
 * with a button that forgets them all so they're picked again; nothing when there are none.
 */
export function NoPlaceFoundNote({ count: n }: { count: number }) {
  const clear = useNoPlaceFoundStore((state) => state.clear);
  if (n === 0) return null;
  return (
    <>
      {` Leaving out ${count(n, "photo")} an LLM found no place for. `}
      <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={clear}>
        Pick them again
      </Button>
    </>
  );
}

interface NoPlaceFoundProps {
  /** The photo file's path. */
  path: string;
  /** Why the LLM couldn't tell, when it says. */
  reasoning: string;
}

/**
 * Marks a photo the answer gives no place, which Bulk Places remembers in this browser and won't pick
 * again, with a button that forgets it, and the LLM's reasoning when it gives one.
 */
export function NoPlaceFound({ path, reasoning }: NoPlaceFoundProps) {
  const remembered = useNoPlaceFoundStore((state) => state.paths.includes(path));
  const forget = useNoPlaceFoundStore((state) => state.remove);
  const add = useNoPlaceFoundStore((state) => state.add);
  return (
    <div className="text-muted-foreground flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="text-foreground inline-flex items-center gap-1">
          <SearchXIcon className="size-3.5" aria-hidden />
          No place found
        </span>
        {remembered ? "· Won't be picked again." : "· Will be picked again."}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => (remembered ? forget(path) : add([path]))}
        >
          {remembered ? "Pick it again" : "Don't pick it again"}
        </Button>
      </p>
      {reasoning && <p>{reasoning}</p>}
    </div>
  );
}
