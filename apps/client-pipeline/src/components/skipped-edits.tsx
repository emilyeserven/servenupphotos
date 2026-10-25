import { useCombinedDataStore } from "@/stores/combined-data";

/**
 * The edits the last commit left out because their photo file isn't on GitHub anymore (it was
 * deleted or renamed since the edit was made), with the fields each one set, so they can be made
 * again on the photo's new file. The rest of the commit went ahead without them.
 */
export function SkippedEdits() {
  const skipped = useCombinedDataStore((s) => s.lastCommit?.skipped) ?? [];
  if (skipped.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-sm text-amber-700 dark:text-amber-400">
      <p>
        Left out {skipped.length === 1 ? "an edit" : `${skipped.length} edits`} to a photo file that
        isn&apos;t on GitHub anymore (deleted or renamed), and committed the rest:
      </p>
      <ul className="list-disc pl-5">
        {skipped.map((edit) => (
          <li key={edit.path} className="break-words">
            <code>{edit.path.slice(edit.path.lastIndexOf("/") + 1)}</code>:{" "}
            {Object.keys(edit.fields).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
