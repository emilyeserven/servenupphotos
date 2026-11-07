import { useState } from "react";
import { lastOrder, newPresetId } from "@/api/graph-presets";
import { EditorButtons, NameAndOrder } from "@/components/graph-presets/editor-parts";
import { GroupSettings } from "@/components/graph-presets/group-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GraphPresetFile } from "@portfolio/lib/graph-presets";

interface GroupEditorProps {
  /** The saved group; undefined for a new one. */
  group?: GraphPresetFile;
  /** Every saved preset and group. */
  files: GraphPresetFile[];
  onSaved: (id: string) => void;
}

/** The group as typed. */
interface GroupDraft {
  name: string;
  order: number;
}

/** A saved group's draft, or a new group's, last in the row. */
function groupDraft(files: GraphPresetFile[], group?: GraphPresetFile): GroupDraft {
  return group ? { name: group.name, order: group.order } : { name: "", order: lastOrder(files) };
}

/** The file the draft saves, keeping a saved group's ID. */
function groupOf(
  draft: GroupDraft,
  files: GraphPresetFile[],
  saved?: GraphPresetFile,
): GraphPresetFile {
  const name = draft.name.trim();
  return { id: saved?.id ?? newPresetId(name, files), kind: "group", name, order: draft.order };
}

/** The presets in the saved group; none in a new one. */
function presetsIn(files: GraphPresetFile[], group?: GraphPresetFile): GraphPresetFile[] {
  return group ? files.filter((file) => file.group === group.id) : [];
}

/** Edits one preset group, or a new one: its name and where it sits in the Presets picker. */
export function GroupEditor({ group, files, onSaved }: GroupEditorProps) {
  const [draft, setDraft] = useState(() => groupDraft(files, group));
  const next = groupOf(draft, files, group);
  const inside = presetsIn(files, group);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group ? group.name : "New preset group"}</CardTitle>
        <CardDescription>
          A group on the left of the Graph page's Presets picker, listing the presets put in it. Put
          a preset in a group from the preset's own editor, and change a setting in all its presets
          at once below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <NameAndOrder
          name={draft.name}
          order={draft.order}
          placeholder="Camera settings"
          onChange={(part) => setDraft({ ...draft, ...part })}
        />
        <p className="text-muted-foreground text-sm">{insideNote(inside)}</p>
        <EditorButtons
          next={next}
          saved={group}
          why={next.name === "" ? "Give it a name." : ""}
          whyKeep={inside.length > 0 ? "Move its presets out of it first." : ""}
          onSaved={onSaved}
        />
        <GroupSettings inside={inside} />
      </CardContent>
    </Card>
  );
}

/** Which presets are in the group. */
function insideNote(inside: GraphPresetFile[]): string {
  if (inside.length === 0) return "No presets are in it yet, so the Graph page leaves it out.";
  return `In it: ${inside.map((file) => file.name).join(", ")}.`;
}
