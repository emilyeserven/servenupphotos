import { Bookmark } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GraphConfig } from "@/lib/graph-data";
import type { SavedGraphs } from "@/lib/saved-graphs";
import { SELECT_CLASS } from "@/lib/segmented-control";

/**
 * The Save as preset button: it asks for a name, then keeps the graph's settings (not its filters)
 * as one of the visitor's own presets, in their browser.
 */
export function SavePresetButton({ saved, config }: { saved: SavedGraphs; config: GraphConfig }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    saved.save(name.trim(), config);
    setName("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Bookmark aria-hidden />
          Save as preset
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Name
            <input
              value={name}
              placeholder="My graph"
              onChange={(e) => setName(e.target.value)}
              className={`${SELECT_CLASS} cursor-text`}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Kept in this browser only. The filters aren't saved with it.
          </p>
          <Button type="submit" size="sm" disabled={name.trim() === ""}>
            Save preset
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
