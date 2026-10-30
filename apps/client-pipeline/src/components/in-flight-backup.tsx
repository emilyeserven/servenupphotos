import { useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, HistoryIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { type InFlightWork, type RestoreResult, parseWork, workCount } from "@/api/backup";
import { Button } from "@/components/ui/button";
import { currentWork, downloadWork, restoreWork } from "@/lib/in-flight-work";
import { useInFlightBackupStore } from "@/stores/in-flight-backup";

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/** What a restore did, in a line. */
function restoredLine(result: RestoreResult, edits: number): string {
  const parts = [
    `${plural(result.restored, "file")} restored`,
    result.unchanged > 0 && `${result.unchanged} already as saved`,
    edits > 0 && `${plural(edits, "browser edit")} added`,
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

/** Restores work after asking, and says how it went. */
function useRestore(setMessage: (message: string) => void) {
  const queryClient = useQueryClient();
  return async (work: InFlightWork, from: string) => {
    const question = `Restore ${plural(workCount(work), "change")} from ${from}? They replace any changes waiting for Commit to the same files.`;
    if (!window.confirm(question)) return;
    try {
      const result = await restoreWork(work, queryClient);
      setMessage(restoredLine(result, Object.keys(work.localEdits).length));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
}

/**
 * The sync panel's in-flight work backup: **Export** downloads everything waiting for Commit as a
 * JSON file named with the time, **Import** loads one back, and the copy kept in this browser while
 * the pipeline was offline can be restored or downloaded.
 */
export function InFlightBackupSection() {
  const [message, setMessage] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const restore = useRestore(setMessage);
  const exportNow = async () => {
    try {
      downloadWork(await currentWork());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await restore(parseWork(await file.text()), file.name);
    } catch {
      setMessage(`${file.name} isn't an in-flight work export.`);
    }
    if (input.current) input.current.value = "";
  };
  return (
    <section className="flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground mr-auto">In-flight work</span>
        <Button variant="outline" size="sm" onClick={() => void exportNow()}>
          <DownloadIcon />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
          <UploadIcon />
          Import
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="In-flight work file to import"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </div>
      <BrowserCopy onRestore={(work) => void restore(work, "this browser's copy")} />
      {message && <p className="text-muted-foreground text-xs">{message}</p>}
    </section>
  );
}

/** The copy of the in-flight work kept in this browser, when there is one with changes. */
function BrowserCopy({ onRestore }: { onRestore: (work: InFlightWork) => void }) {
  const backup = useInFlightBackupStore((s) => s.backup);
  if (!backup || workCount(backup) === 0) return null;
  const when = new Date(backup.exported).toLocaleString();
  return (
    <div className="bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
      <HistoryIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="mr-auto">
        Kept in this browser while offline: {plural(workCount(backup), "change")}, {when}
      </span>
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() => onRestore(backup)}
      >
        Restore
      </button>
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() => downloadWork(backup)}
      >
        Download
      </button>
    </div>
  );
}
