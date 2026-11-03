import { useMutation } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  deleteViewerMutation,
  type ViewerLikes,
  viewerId,
  importedText,
  type ParsedLikes,
  parseLikes,
  saveViewerMutation,
} from "@/api/viewer-likes";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";

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
function nextViewer(name: string, photos: number[], viewer?: ViewerLikes): ViewerLikes {
  const trimmed = name.trim();
  return { id: viewer ? viewer.id : viewerId(trimmed), name: trimmed, photos };
}

/** Pastes or uploads one person's list of liked photos, new or replacing the one they sent before. */
export function ViewerImporter({ viewer, viewers, titles, onSaved }: ViewerImporterProps) {
  const [name, setName] = useState(() => (viewer ? viewer.name : ""));
  const [text, setText] = useState("");
  const parsed = parseLikes(text);
  const next = nextViewer(name, nextPhotos(parsed, text, viewer), viewer);
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
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton
            next={next}
            viewer={viewer}
            viewers={viewers}
            onSaved={(id) => {
              setText("");
              onSaved(id);
            }}
          />
          <RemoveButton viewer={viewer} />
        </div>
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
  const photos = viewer.photos.length === 1 ? "photo" : "photos";
  return `${viewer.photos.length} liked ${photos}. ${importedText(viewer.importedAt)}. Paste their new list to replace it.`;
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
        The photo IDs from My Likes' “Send to photographer”, separated by commas, or a JSON array
        such as [281, 284].
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
        {parsed.ids.length} {parsed.ids.length === 1 ? "photo" : "photos"} in the list.
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

/** Why a new person can't be saved yet: they have no list, or someone saved has their ID. */
function newViewerProblem(next: ViewerLikes, viewers: ViewerLikes[]): string {
  if (next.photos.length === 0) return "Paste or upload their list.";
  const taken = viewers.find((f) => f.id === next.id);
  return taken
    ? `“${taken.name}” is already here. Pick them on the left to replace their likes.`
    : "";
}

/** Whether saving would change nothing: the same name and the same photos. */
function unchanged(next: ViewerLikes, viewer?: ViewerLikes): boolean {
  if (!viewer) return false;
  return canonicalJson(next) === canonicalJson({ ...viewer, importedAt: undefined });
}

interface SaveButtonProps {
  next: ViewerLikes;
  viewer?: ViewerLikes;
  viewers: ViewerLikes[];
  onSaved: (id: string) => void;
}

function SaveButton({ next, viewer, viewers, onSaved }: SaveButtonProps) {
  const save = useMutation(saveViewerMutation);
  const why = whyNot(next, viewer, viewers);
  return (
    <>
      <Button
        disabled={why !== "" || unchanged(next, viewer) || save.isPending}
        onClick={() => save.mutate(next, { onSuccess: () => onSaved(next.id) })}
      >
        <Busy busy={save.isPending} />
        {viewer ? "Save and replace likes" : "Import likes"}
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

/** Removes a saved person and their likes; nothing for a new one. */
function RemoveButton({ viewer }: { viewer?: ViewerLikes }) {
  const remove = useMutation(deleteViewerMutation);
  if (!viewer) return null;
  return (
    <RemoveEntryButton
      label="Remove person"
      remove={{ ...remove, mutate: () => remove.mutate(viewer.id) }}
    />
  );
}
