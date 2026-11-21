import { useNavigate } from "@tanstack/react-router";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import type { ChangeEvent } from "react";
import { ErrorNote } from "@/components/error-note";
import { PasteAnswer } from "@/components/paste-answer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { downloadFile } from "@/lib/album-layout-editor";
import {
  type LightroomMerge,
  mergeLightroomAlbums,
  readLightroomAlbums,
} from "@/lib/lightroom-albums";
import { askFirst } from "@/stores/confirm";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";
import { count } from "@portfolio/lib/words";

/** A read import: the merge to look over and the source it came from. */
interface ImportRead {
  merge: LightroomMerge;
  source: string;
}

/**
 * Reads the pasted text and merges it with the albums already on the page, without saving anything
 * yet. Throws a sentence a user can read when there's no list in it.
 */
function readImport(text: string): ImportRead {
  const file = readLightroomAlbums(text);
  const current = useLightroomAlbumsStore.getState().file?.items ?? [];
  return { merge: mergeLightroomAlbums(current, file.items), source: file.source };
}

/**
 * Import: pastes an LLM's answer or loads an exported file, shows what it changes, and puts it in place of the
 * current list, keeping each matched album's stage and notes. Export downloads the list with every stage and note.
 */
export function ImportCard() {
  const pasted = usePastedAnswer(readImport);
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
          onChange={(event) => void loadFile(event, pasted.setTyped)}
        />
        <PasteAnswer
          pasted={pasted}
          label="Read the list"
          placeholder='{ "source": "lightroom-classic", "items": [ … ] }'
        >
          <ListButtons />
        </PasteAnswer>
        {pasted.answer && (
          <ImportReview key={pasted.reviews} read={pasted.answer} onDone={pasted.clear} />
        )}
      </CardContent>
    </Card>
  );
}

async function loadFile(event: ChangeEvent<HTMLInputElement>, setText: (text: string) => void) {
  const file = event.target.files?.[0];
  if (file) setText(await file.text());
  event.target.value = "";
}

/** Exports the list, or forgets it. */
function ListButtons() {
  const file = useLightroomAlbumsStore((state) => state.file);
  const clear = useLightroomAlbumsStore((state) => state.clear);
  const forget = async () => {
    const yes = await askFirst({
      question: "Forget every album, stage and note on this page?",
      note: "Export first to keep them.",
      action: "Forget",
    });
    if (yes) clear();
  };
  return (
    <>
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
    </>
  );
}

/** The exported file's name, with today's date, such as lightroom-albums-2026-11-07.json. */
function exportName() {
  return `lightroom-albums-${new Date().toISOString().slice(0, 10)}.json`;
}

interface ImportReviewProps {
  read: ImportRead;
  onDone: () => void;
}

/** What the import changes, with a button to use it. */
function ImportReview({ read, onDone }: ImportReviewProps) {
  const replace = useLightroomAlbumsStore((state) => state.replace);
  const navigate = useNavigate();
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
    <ErrorNote>
      <p>
        {count(merge.dropped.length, "album")} with a stage or notes{" "}
        {merge.dropped.length === 1 ? "isn't" : "aren't"} in the new list and will be dropped:
      </p>
      <ul className="list-disc ps-5">
        {merge.dropped.map((album) => (
          <li key={album.path}>{album.path}</li>
        ))}
      </ul>
    </ErrorNote>
  );
}
