import { FileDiffIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { JsonCodeBlock } from "@/components/json-code-block";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { type DiffRow, diffLines, foldUnchanged } from "@/lib/line-diff";
import { cn } from "@/lib/utils";

type View = "changes" | "file";

/**
 * A file's JSON with the lines it changes from `base` marked + and −, pretty-printed on both sides
 * so only real changes show. A toggle switches to the whole file.
 */
export function JsonDiffBlock({
  value,
  base,
  title = "JSON",
  baseBranch = "the base branch",
}: {
  value: unknown;
  /** The JSON it's compared against. */
  base: unknown;
  title?: string;
  /** Where base is from, named in the summary. */
  baseBranch?: string;
}) {
  const [view, setView] = useState<View>("changes");
  const before = JSON.stringify(base, null, 2);
  const after = JSON.stringify(value, null, 2);
  const oldLines = useHighlightedCode(before, "json");
  const newLines = useHighlightedCode(after, "json");
  const lines = useMemo(() => diffLines(before.split("\n"), after.split("\n")), [before, after]);
  const added = lines.filter((line) => line.kind === "added").length;
  const removed = lines.filter((line) => line.kind === "removed").length;
  const toggle = <ViewToggle view={view} onChange={setView} />;

  if (view === "file") {
    return <JsonCodeBlock value={value} title={title} actions={toggle} />;
  }
  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <FileDiffIcon />
          {title}
        </CodeBlockTitle>
        <CodeBlockActions>
          {toggle}
          <CodeBlockCopyButton value={after} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <p className="text-muted-foreground border-b px-4 py-1.5 font-sans">
        {added + removed === 0 ? (
          `Same JSON as on ${baseBranch}.`
        ) : (
          <>
            <span className="text-emerald-700 dark:text-emerald-400">+{added}</span>{" "}
            <span className="text-destructive">−{removed}</span> against {baseBranch}
          </>
        )}
      </p>
      {added + removed > 0 && (
        <CodeBlockContent className="max-h-[32rem]">
          {foldUnchanged(lines).map((row, index) => (
            <DiffRowLine key={index} row={row} oldLines={oldLines} newLines={newLines} />
          ))}
        </CodeBlockContent>
      )}
    </CodeBlock>
  );
}

const ROW_CLASSES = {
  same: "",
  removed: "",
  added:
    "bg-emerald-500/10 after:text-emerald-700 dark:bg-emerald-400/10 dark:after:text-emerald-400",
};

function DiffRowLine({
  row,
  oldLines,
  newLines,
}: {
  row: DiffRow;
  oldLines: ReactNode[];
  newLines: ReactNode[];
}) {
  if (row.kind === "folded") return <FoldedLines count={row.count} />;
  const content = (row.kind === "removed" ? oldLines : newLines)[row.index];
  return (
    <CodeBlockLine
      variant={row.kind === "same" ? "default" : row.kind}
      className={ROW_CLASSES[row.kind]}
    >
      <LineNumber n={row.index + 1} />
      {content}
    </CodeBlockLine>
  );
}

/** Stands in for a run of unchanged lines between hunks. */
function FoldedLines({ count }: { count: number }) {
  return (
    <CodeBlockLine className="text-muted-foreground bg-foreground/5 my-1 font-sans italic select-none">
      <LineNumber />
      {count === 1 ? "1 unchanged line" : `${count} unchanged lines`}
    </CodeBlockLine>
  );
}

/** The line's number on its side: the base's for a removed line, the file's otherwise. */
function LineNumber({ n }: { n?: number }) {
  return (
    <span className="text-muted-foreground me-3 inline-block w-7 text-end not-italic select-none">
      {n}
    </span>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div role="group" aria-label="Show" className="bg-background flex rounded-md border p-0.5">
      {(
        [
          ["changes", "Changes"],
          ["file", "Whole file"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            "focus-visible:ring-ring rounded px-2 py-0.5 font-sans text-xs outline-none focus-visible:ring-2",
            view === value
              ? "bg-secondary text-secondary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
