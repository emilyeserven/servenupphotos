import { type FormEvent, useState } from "react";
import { PresetSettings } from "@/components/graph-builder/preset-settings";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import type { SavedGraphs } from "@/lib/saved-graphs";
import { SELECT_CLASS } from "@/lib/segmented-control";

/**
 * The Save as preset tab's insides: the graph's settings to check, a name, and the **Save preset**
 * button, which keeps the settings (not the filters) as one of the visitor's own presets, in their
 * browser, then calls `onSaved`.
 */
export function SavePresetForm({
  saved,
  config,
  onSaved,
}: {
  saved: SavedGraphs;
  config: GraphConfig;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    saved.save(name.trim(), config);
    setName("");
    onSaved();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 rounded-lg border p-2 sm:w-72">
        <PresetSettings name="These settings are saved" config={config} />
      </div>
      <div className="flex flex-col gap-2 sm:w-64">
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
          Kept in this browser only, under Yours in Presets. The filters aren't saved with it.
        </p>
        <Button type="submit" size="sm" disabled={name.trim() === ""}>
          Save preset
        </Button>
      </div>
    </form>
  );
}
