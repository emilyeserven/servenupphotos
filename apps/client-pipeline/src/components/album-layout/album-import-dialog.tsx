import { CheckIcon, UploadIcon } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import type { Group } from "@/api/organize";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { type AlbumImport, type AlbumLayout, readAlbumImport } from "@/lib/album-layout";

interface AlbumImportDialogProps {
  album: Group;
  /** The IDs of the album's photos, the only ones an import keeps. */
  inAlbum: Set<number>;
  /** Puts the imported covers and rows in the editor, to look over before saving. */
  onImport: (layout: AlbumLayout) => void;
}

/**
 * A button that opens a box to paste an album file's JSON into, or load one from this computer,
 * and read its covers and rows into the editor. Nothing is saved until Save layout.
 */
export function AlbumImportDialog({ album, inAlbum, onImport }: AlbumImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const read = text.trim() ? readAlbumImport(text, album, inAlbum) : undefined;
  const change = (next: boolean) => {
    setOpen(next);
    setText("");
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UploadIcon aria-hidden />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import an album file</DialogTitle>
          <DialogDescription>
            Paste the JSON of an exported album, or of an album's own file, or load one. Its covers
            and rows replace the ones in the editor, to look over before you save them.
          </DialogDescription>
        </DialogHeader>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Load an album file"
          className="file:bg-muted text-sm file:mr-3 file:rounded-md file:border file:px-2 file:py-1 file:text-xs"
          onChange={(event) => void loadFile(event, setText)}
        />
        <Textarea
          aria-label="Album JSON"
          value={text}
          placeholder='{ "covers": [12, 3], "layout": [{ "textAbove": "", "photos": [12], "textBelow": "" }] }'
          className="max-h-[40vh] min-h-32 font-mono"
          onChange={(event) => setText(event.target.value)}
        />
        <ImportOutcome read={read} />
        <DialogFooter>
          <Button
            disabled={!read || "error" in read}
            onClick={() => {
              if (read && "layout" in read) onImport(read.layout);
              change(false);
            }}
          >
            Put it in the editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reads the chosen file's text into the box. */
async function loadFile(event: ChangeEvent<HTMLInputElement>, setText: (text: string) => void) {
  const file = event.target.files?.[0];
  if (file) setText(await file.text());
}

/** What the import has, or why it can't be used. */
function ImportOutcome({ read }: { read?: AlbumImport }) {
  if (!read) return null;
  if ("error" in read) return <p className="text-destructive text-sm">{read.error}</p>;
  const { covers, layout } = read.layout;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {count(covers.length, "cover")} and {count(layout.length, "row")}.
      </p>
      {read.notes.map((note) => (
        <p key={note} className="text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  );
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
