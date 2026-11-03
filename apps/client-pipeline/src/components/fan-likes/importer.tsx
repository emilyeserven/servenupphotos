import { useMutation } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  deleteFanMutation,
  type FanLikes,
  fanId,
  importedText,
  type ParsedLikes,
  parseLikes,
  saveFanMutation,
} from "@/api/fan-likes";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";

interface FanImporterProps {
  /** The saved person; undefined for a new one. */
  fan?: FanLikes;
  /** Everyone saved, so a new person can't take someone's ID. */
  fans: FanLikes[];
  /** The saved photos' titles by ID, to say which pasted IDs aren't saved photos. */
  titles: Map<number, string>;
  /** With the saved person's ID. */
  onSaved: (id: string) => void;
}

/** The photos saving would write: the pasted list, or else the person's saved one. */
function nextPhotos(parsed: ParsedLikes, text: string, fan?: FanLikes): number[] {
  if (text.trim() !== "") return parsed.ids;
  return fan ? fan.photos : [];
}

/** What saving would write: the typed name and the photos, keeping a saved person's ID. */
function nextFan(name: string, photos: number[], fan?: FanLikes): FanLikes {
  const trimmed = name.trim();
  return { id: fan ? fan.id : fanId(trimmed), name: trimmed, photos };
}

/** Pastes or uploads one person's list of liked photos, new or replacing the one they sent before. */
export function FanImporter({ fan, fans, titles, onSaved }: FanImporterProps) {
  const [name, setName] = useState(() => (fan ? fan.name : ""));
  const [text, setText] = useState("");
  const parsed = parseLikes(text);
  const next = nextFan(name, nextPhotos(parsed, text, fan), fan);
  return (
    <Card>
      <ImporterHeader fan={fan} />
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
            fan={fan}
            fans={fans}
            onSaved={(id) => {
              setText("");
              onSaved(id);
            }}
          />
          <RemoveButton fan={fan} />
        </div>
      </CardContent>
    </Card>
  );
}

function ImporterHeader({ fan }: { fan?: FanLikes }) {
  return (
    <CardHeader>
      <CardTitle>{fan ? fan.name : "New person"}</CardTitle>
      <CardDescription>{fanNote(fan)}</CardDescription>
    </CardHeader>
  );
}

/** How many photos the saved person liked and when, or how to add a new one. */
function fanNote(fan?: FanLikes): string {
  if (!fan) return "Name who sent the list, then paste or upload it.";
  const photos = fan.photos.length === 1 ? "photo" : "photos";
  return `${fan.photos.length} liked ${photos}. ${importedText(fan.importedAt)}. Paste their new list to replace it.`;
}

/** The pasted list, with a button that reads it from a .txt or .json file instead. */
function ListField({ text, onText }: { text: string; onText: (text: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="fan-likes-list" className="font-medium">
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
        id="fan-likes-list"
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
function whyNot(next: FanLikes, fan: FanLikes | undefined, fans: FanLikes[]): string {
  if (next.name === "") return "Give the person a name.";
  return fan ? "" : newFanProblem(next, fans);
}

/** Why a new person can't be saved yet: they have no list, or someone saved has their ID. */
function newFanProblem(next: FanLikes, fans: FanLikes[]): string {
  if (next.photos.length === 0) return "Paste or upload their list.";
  const taken = fans.find((f) => f.id === next.id);
  return taken
    ? `“${taken.name}” is already here. Pick them on the left to replace their likes.`
    : "";
}

/** Whether saving would change nothing: the same name and the same photos. */
function unchanged(next: FanLikes, fan?: FanLikes): boolean {
  if (!fan) return false;
  return canonicalJson(next) === canonicalJson({ ...fan, importedAt: undefined });
}

interface SaveButtonProps {
  next: FanLikes;
  fan?: FanLikes;
  fans: FanLikes[];
  onSaved: (id: string) => void;
}

function SaveButton({ next, fan, fans, onSaved }: SaveButtonProps) {
  const save = useMutation(saveFanMutation);
  const why = whyNot(next, fan, fans);
  return (
    <>
      <Button
        disabled={why !== "" || unchanged(next, fan) || save.isPending}
        onClick={() => save.mutate(next, { onSuccess: () => onSaved(next.id) })}
      >
        <Busy busy={save.isPending} />
        {fan ? "Save and replace likes" : "Import likes"}
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

/** Removes a saved person and their likes; nothing for a new one. */
function RemoveButton({ fan }: { fan?: FanLikes }) {
  const remove = useMutation(deleteFanMutation);
  if (!fan) return null;
  return (
    <RemoveEntryButton
      label="Remove person"
      remove={{ ...remove, mutate: () => remove.mutate(fan.id) }}
    />
  );
}
