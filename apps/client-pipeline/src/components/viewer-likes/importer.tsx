import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  deleteViewerMutation,
  type ViewerLikes,
  viewerId,
  viewerNamed,
  importedText,
  type ParsedLikes,
  parseLikes,
  saveViewerMutation,
} from "@/api/viewer-likes";
import { EntryEditorButtons } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { count } from "@portfolio/lib/words";

interface ViewerImporterProps {
  /** The saved person; undefined for a new one. */
  viewer?: ViewerLikes;
  /** Everyone saved, so a new person can't take someone's ID. */
  viewers: ViewerLikes[];
  /** The saved photos' titles by ID, to say which pasted IDs aren't saved photos. */
  titles: Map<number, string>;
  /** With the saved person's ID. */
  onSaved: (id: string) => void;
}

/** The photos saving would write: the pasted list, or else the person's saved one. */
function nextPhotos(parsed: ParsedLikes, text: string, viewer?: ViewerLikes): number[] {
  if (text.trim() !== "") return parsed.ids;
  return viewer ? viewer.photos : [];
}

/** What saving would write: the typed name and the photos, keeping a saved person's ID. */
function nextViewer(
  name: string,
  photos: number[],
  viewer: ViewerLikes | undefined,
  viewers: ViewerLikes[],
): ViewerLikes {
  const trimmed = name.trim();
  return { id: viewer ? viewer.id : viewerId(trimmed, viewers), name: trimmed, photos };
}

/** Pastes or uploads one person's list of liked photos, new or replacing the one they sent before. */
export function ViewerImporter({ viewer, viewers, titles, onSaved }: ViewerImporterProps) {
  const [name, setName] = useState(() => (viewer ? viewer.name : ""));
  const [text, setText] = useState("");
  const parsed = parseLikes(text);
  const next = nextViewer(name, nextPhotos(parsed, text, viewer), viewer, viewers);
  return (
    <Card>
      <ImporterHeader viewer={viewer} />
      <CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Name</span>
          <Input value={name} placeholder="Jane" onChange={(e) => setName(e.target.value)} />
        </label>
        <ListField text={text} onText={setText} />
        <ParsedNote text={text} parsed={parsed} titles={titles} />
        <EntryEditorButtons
          next={next}
          saved={viewer && { ...viewer, importedAt: undefined }}
          save={saveViewerMutation}
          remove={deleteViewerMutation}
          whyNot={(person) => whyNot(person, viewer, viewers)}
          saveLabel="Import likes"
          changesLabel="Save and replace likes"
          removeLabel="Remove person"
          onSaved={(id) => {
            setText("");
            onSaved(id);
          }}
        />
      </CardContent>
    </Card>
  );
}

function ImporterHeader({ viewer }: { viewer?: ViewerLikes }) {
  return (
    <CardHeader>
      <CardTitle>{viewer ? viewer.name : "New person"}</CardTitle>
      <CardDescription>{viewerNote(viewer)}</CardDescription>
    </CardHeader>
  );
}

/** How many photos the saved person liked and when, or how to add a new one. */
function viewerNote(viewer?: ViewerLikes): string {
  if (!viewer) return "Name who sent the list, then paste or upload it.";
  return `${count(viewer.photos.length, "liked photo")}. ${importedText(viewer.importedAt)}. Paste their new list to replace it.`;
}

/** The pasted list, with a button that reads it from a .txt or .json file instead. */
function ListField({ text, onText }: { text: string; onText: (text: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="viewer-likes-list" className="font-medium">
          Their list
        </label>
        <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
          <UploadIcon aria-hidden />
          Upload a file
        </Button>
        <input
          ref={file}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          className="hidden"
          onChange={(e) => void e.target.files?.[0]?.text().then(onText)}
        />
      </div>
      <Textarea
        id="viewer-likes-list"
        rows={4}
        value={text}
        placeholder="281, 284, 286"
        className="font-mono"
        onChange={(e) => onText(e.target.value)}
      />
      <span className="text-muted-foreground text-xs">
        What My Likes' “Send to photographer” makes: the Discord list of photo links, or the photo
        IDs separated by commas. A JSON array such as [281, 284] works too.
      </span>
    </div>
  );
}

interface ParsedNoteProps {
  text: string;
  parsed: ParsedLikes;
  titles: Map<number, string>;
}

/** Once a list is pasted, how many photos it has, and what in it isn't a saved photo. */
function ParsedNote({ text, parsed, titles }: ParsedNoteProps) {
  if (text.trim() === "") return null;
  const unknown = parsed.ids.filter((id) => !titles.has(id));
  return (
    <ul className="text-muted-foreground flex flex-col gap-0.5 text-sm">
      <li>
        {count(parsed.ids.length, "photo")} in the list
        {parsed.fromLinks ? ", read from its photo links. Titles and comments are ignored." : "."}
      </li>
      <Warning label="Not a saved photo, kept anyway" items={unknown} />
      <Warning label="Not photo IDs, left out" items={parsed.skipped} />
    </ul>
  );
}

function Warning({ label, items }: { label: string; items: (string | number)[] }) {
  if (items.length === 0) return null;
  return (
    <li className="text-amber-700 dark:text-amber-400">
      {label}: {items.join(", ")}
    </li>
  );
}

/** Why the person can't be saved yet, or "" when they can. */
function whyNot(
  next: ViewerLikes,
  viewer: ViewerLikes | undefined,
  viewers: ViewerLikes[],
): string {
  if (next.name === "") return "Give the person a name.";
  return viewer ? "" : newViewerProblem(next, viewers);
}

/** Why a new person can't be saved yet: they have no list, or someone saved has their name. */
function newViewerProblem(next: ViewerLikes, viewers: ViewerLikes[]): string {
  if (next.photos.length === 0) return "Paste or upload their list.";
  const taken = viewerNamed(next.name, viewers);
  return taken
    ? `“${taken.name}” is already here. Pick them on the left to replace their likes.`
    : "";
}
