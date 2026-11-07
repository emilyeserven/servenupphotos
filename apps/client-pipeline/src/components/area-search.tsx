import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { type Area, areasQuery } from "@/api/areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Finds an area on OpenStreetMap by name or Wikidata ID, and adds the one picked. */
export function AreaSearch({ initial, onPick }: { initial: string; onPick: (area: Area) => void }) {
  const [text, setText] = useState(initial);
  const [asked, setAsked] = useState("");
  const found = useQuery(areasQuery(asked));
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(text.trim());
        }}
      >
        <Input
          aria-label="Area to find"
          placeholder="A park, neighbourhood or city, or a Wikidata ID like Q1490"
          className="h-8 w-96"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm" disabled={found.isFetching}>
          <Search aria-hidden />
          {found.isFetching ? "Looking…" : "Find an area"}
        </Button>
      </form>
      <AreaResults asked={asked} found={found} onPick={onPick} />
    </div>
  );
}

interface AreaResultsProps {
  asked: string;
  found: { data?: Area[]; error: Error | null };
  onPick: (area: Area) => void;
}

/** The areas found, each added by clicking it, or why there are none. */
function AreaResults({ asked, found, onPick }: AreaResultsProps) {
  if (found.error) return <p className="text-destructive text-xs">{found.error.message}</p>;
  const areas = asked ? found.data : undefined;
  return areas ? <AreaList areas={areas} onPick={onPick} /> : null;
}

/** The areas found, each a button that adds it; a note when none match. */
function AreaList({ areas, onPick }: { areas: Area[]; onPick: (area: Area) => void }) {
  if (areas.length === 0) {
    return <p className="text-muted-foreground text-xs">No area with an outline matches.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {areas.map((area) => (
        <li key={area.osm}>
          <button
            type="button"
            className="hover:bg-accent w-full rounded-md border px-2 py-1 text-left text-sm"
            onClick={() => onPick(area)}
          >
            <span className="font-medium">{area.name}</span>{" "}
            <span className="text-muted-foreground text-xs">
              {area.kind} · {area.place}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
