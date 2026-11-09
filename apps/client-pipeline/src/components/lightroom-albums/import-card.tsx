import { DownloadIcon, Trash2Icon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { count } from "@/components/update-data-shared";
import { downloadFile } from "@/lib/album-layout-editor";
import {
  type LightroomMerge,
  mergeLightroomAlbums,
  readLightroomAlbums,
} from "@/lib/lightroom-albums";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** A read import: the merge to look over and the source it came from, or why it couldn't be read. */
type ImportRead = { merge: LightroomMerge; source: string } | { error: string };

/** Reads the pasted text and merges it with the albums already on the page, without saving anything yet. */
function readImport(text: string): ImportRead {
  try {
    const file = readLightroomAlbums(text);
    const current = useLightroomAlbumsStore.getState().file?.items ?? [];
    return { merge: mergeLightroomAlbums(current, file.items), source: file.source };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Import: pastes an LLM's answer or loads an exported file, shows what it changes, and puts it in place of the
 * current list, keeping each matched album's stage and notes. Export downloads the list with every stage and note.
 */
export function ImportCard() {
  const [text, setText] = useState("");
  const [read, setRead] = useState<ImportRead>();
  const change = (value: string) => {
    setText(value);
    setRead(undefined);
  };
  const done = () => change("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Paste the LLM&apos;s answer, or load a file exported from this page on another computer.
          Albums are matched by their path, such as <code>Travel/Busan</code>, so importing a new
          list keeps the stage and notes of every album that&apos;s still in it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input
          type="file"
          accept="application/json,.json,.txt,.md"
          aria-label="Load an exported file"
          className="file:bg-muted text-sm file:mr-3 file:rounded-md file:border file:px-2 file:py-1 file:text-xs"
          onChange={(event) => void loadFile(event, change)}
        />
        <Textarea
          aria-label="LLM answer or exported JSON"
          value={text}
          placeholder='{ "source": "lightroom-classic", "items": [ … ] }'
          className="max-h-[40vh] min-h-32 font-mono"
          onChange={(event) => change(event.target.value)}
        />
        <ImportReview read={read} onDone={done} />
        <ImportButtons
          canRead={text.trim() !== "" && !read}
          onRead={() => setRead(readImport(text))}
        />
      </CardContent>
    </Card>
  );
}

async function loadFile(event: ChangeEvent<HTMLInputElement>, setText: (text: string) => void) {
  const file = event.target.files?.[0];
  if (file) setText(await file.text());
  event.target.value = "";
}

interface ImportButtonsProps {
  canRead: boolean;
  onRead: () => void;
}

/** Reads the import, exports the list, or forgets it. */
function ImportButtons({ canRead, onRead }: ImportButtonsProps) {
  const file = useLightroomAlbumsStore((state) => state.file);
  const clear = useLightroomAlbumsStore((state) => state.clear);
  const forget = () => {
    if (confirm("Forget every album, stage and note on this page? Export first to keep them."))
      clear();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={!canRead} onClick={onRead}>
        Read the list
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!file}
        onClick={() => downloadFile(exportName(), JSON.stringify(file, null, 2))}
      >
        <DownloadIcon />
        Export
      </Button>
      <Button type="button" variant="destructive" disabled={!file} onClick={forget}>
        <Trash2Icon />
        Forget the list
      </Button>
    </div>
  );
}

/** The exported file's name, with today's date, such as lightroom-albums-2026-11-07.json. */
function exportName() {
  return `lightroom-albums-${new Date().toISOString().slice(0, 10)}.json`;
}

interface ImportReviewProps {
  read?: ImportRead;
  onDone: () => void;
}

/** What the import changes, with a button to use it, or why it couldn't be read. */
function ImportReview({ read, onDone }: ImportReviewProps) {
  const replace = useLightroomAlbumsStore((state) => state.replace);
  const navigate = useNavigate();
  if (!read) return null;
  if ("error" in read) return <p className="text-destructive text-sm">{read.error}</p>;
  const { merge, source } = read;
  const use = () => {
    replace(source, merge.items);
    onDone();
    void navigate({ to: "/lightroom-albums" });
  };
  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-md border p-3 text-sm">
      <p>
        {count(merge.added, "new album")}, {count(merge.kept, "album")} matched and keeping their
        stage and notes.
        {merge.manual > 0 && ` ${count(merge.manual, "album")} added by hand also kept.`}
      </p>
      <DroppedAlbums merge={merge} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={use}>
          Use this list
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The albums with a stage or notes that the new list doesn't have, which go with their notes. */
function DroppedAlbums({ merge }: { merge: LightroomMerge }) {
  if (merge.dropped.length === 0) return null;
  return (
    <div className="text-destructive">
      <p>
        {count(merge.dropped.length, "album")} with a stage or notes{" "}
        {merge.dropped.length === 1 ? "isn't" : "aren't"} in the new list and will be dropped:
      </p>
      <ul className="list-disc ps-5">
        {merge.dropped.map((album) => (
          <li key={album.path}>{album.path}</li>
        ))}
      </ul>
    </div>
  );
}
