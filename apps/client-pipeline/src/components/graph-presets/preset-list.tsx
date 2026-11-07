import { ChartColumnIcon, FolderIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type GraphPresetFile, type PresetItem, presetRow } from "@portfolio/lib/graph-presets";

/** What a new preset is chosen as, before it's saved. */
export const NEW_PRESET = ":new-preset";

/** What a new preset group is chosen as, before it's saved. */
export const NEW_GROUP = ":new-group";

/** The chosen preset's or group's ID, or NEW_PRESET or NEW_GROUP for a new one. */
export type Chosen = string;

interface PresetListProps {
  files: GraphPresetFile[];
  chosen: Chosen;
  onChoose: (chosen: Chosen) => void;
}

/** The presets and groups in the Graph page's order, each group with its presets under it, and buttons to add more. */
export function PresetList({ files, chosen, onChoose }: PresetListProps) {
  const row = presetRow(files, true);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Presets</CardTitle>
        <CardDescription>
          In the order the Graph page shows them. A group with no presets doesn't show there.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {row.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {row.map((item) => (
          <RowEntry key={entryKey(item)} item={item} chosen={chosen} onChoose={onChoose} />
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          <NewButton label="New preset" value={NEW_PRESET} chosen={chosen} onChoose={onChoose} />
          <NewButton label="New group" value={NEW_GROUP} chosen={chosen} onChoose={onChoose} />
        </div>
      </CardContent>
    </Card>
  );
}

/** What a row item is kept apart by. */
function entryKey(item: PresetItem): string {
  return item.kind === "preset" ? item.preset.id : item.id;
}

interface RowEntryProps {
  item: PresetItem;
  chosen: Chosen;
  onChoose: (chosen: Chosen) => void;
}

/** A preset, or a group with its presets indented under it. */
function RowEntry({ item, chosen, onChoose }: RowEntryProps) {
  if (item.kind === "preset") {
    const { id, name } = item.preset;
    return <ListButton id={id} name={name} chosen={chosen} onChoose={onChoose} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <ListButton id={item.id} name={item.name} group chosen={chosen} onChoose={onChoose} />
      <div className="ml-4 flex flex-col gap-1 border-l pl-2">
        {item.presets.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-xs">No presets in it yet.</p>
        )}
        {item.presets.map(({ id, name }) => (
          <ListButton key={id} id={id} name={name} chosen={chosen} onChoose={onChoose} />
        ))}
      </div>
    </div>
  );
}

interface ListButtonProps {
  id: string;
  name: string;
  /** Whether it's a group, marked with a folder. */
  group?: boolean;
  chosen: Chosen;
  onChoose: (chosen: Chosen) => void;
}

function ListButton({ id, name, group = false, chosen, onChoose }: ListButtonProps) {
  const Icon = group ? FolderIcon : ChartColumnIcon;
  return (
    <button
      type="button"
      onClick={() => onChoose(id)}
      aria-current={id === chosen}
      className={cn(
        "hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        id === chosen && "bg-muted font-medium",
      )}
    >
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </button>
  );
}

interface NewButtonProps {
  label: string;
  value: Chosen;
  chosen: Chosen;
  onChoose: (chosen: Chosen) => void;
}

function NewButton({ label, value, chosen, onChoose }: NewButtonProps) {
  return (
    <Button variant="outline" size="sm" disabled={chosen === value} onClick={() => onChoose(value)}>
      <PlusIcon aria-hidden />
      {label}
    </Button>
  );
}
