import type { QueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import type { ScannedPhotos } from "@/api/data";
import type { PendingSave } from "@/api/scan-changes";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WaitingForCommit } from "@/components/waiting-for-commit";

/** "1 file", "2 files". */
export function count(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

/** Photo files that couldn't be read; while there are any, nothing can be changed. */
export function Unreadable({
  files,
  blocking = false,
}: {
  files: ScannedPhotos["unreadable"];
  blocking?: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <div className="text-destructive flex flex-col gap-1 text-sm">
      <p>
        {files.length === 1 ? "This file couldn't" : "These files couldn't"} be read
        {blocking ? ", so nothing can be changed until it's fixed:" : ":"}
      </p>
      <ul className="list-disc pl-5">
        {files.map((f) => (
          <li key={f.path}>
            <code className="break-all">{f.path}</code>: {f.error}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where a previewed change will go: into the batch, which Commit sends to GitHub. */
export function PreviewDestination({ scan }: { scan: ScannedPhotos }) {
  if (!scan.pullRequest) {
    return (
      <>
        It&apos;s saved in the app, waiting for Commit, which opens a new &quot;Add photo data&quot;
        pull request against <code>{scan.branch}</code> with it.
      </>
    );
  }
  return (
    <>
      It&apos;s saved in the app, waiting for Commit, which sends it to <code>{scan.branch}</code>,
      in{" "}
      <ExternalLink href={scan.pullRequest.url}>
        pull request #{scan.pullRequest.number}
      </ExternalLink>
      .
    </>
  );
}

/** What a change did, then where it goes: Commit sends it to GitHub. */
export function CommitSuccess({ result, children }: { result: PendingSave; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t pt-6 text-sm">
      <p>{children}, saved in the app.</p>
      <p className="text-muted-foreground">
        <WaitingForCommit pullRequestUrl={result.pullRequestUrl} what="The changes" /> The portfolio
        uses them once that pull request is merged.
      </p>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-foreground inline-flex items-center gap-1 underline underline-offset-4"
    >
      {children}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

/** After a bulk change saved photo JSON: every preview and in-flight read is stale. */
export function invalidatePhotoReads(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["data"] });
  void queryClient.invalidateQueries({ queryKey: ["photos"] });
}

/** One file a bulk change previews, collapsed to its name and a note, with the details inside. */
export function FileDetails({
  path,
  note,
  swatch,
  children,
}: {
  path: string;
  note: string;
  /** A color to show beside the note, such as the photo's average color. */
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <li>
      <details>
        <summary className="hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
          <code className="min-w-0 truncate">{path.split("/").pop()}</code>
          <span className="text-muted-foreground flex shrink-0 items-center gap-2">
            {swatch && (
              <span
                aria-hidden
                className="size-4 rounded-sm border"
                style={{ backgroundColor: swatch }}
              />
            )}
            {note}
          </span>
        </summary>
        {children}
      </details>
    </li>
  );
}

/** A checkbox option of a bulk change, with its label and a hint under it. */
export function OptionCheckbox({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  );
}

/**
 * A bulk change's preview: when no file changes, why not; otherwise how many do and where the
 * change goes, the files that can't be read, then the rest of the preview.
 */
export function ScanPreviewBody({
  scan,
  changed,
  nothing,
  headline,
  children,
}: {
  scan: ScannedPhotos;
  /** How many files the change touches. */
  changed: number;
  /** Why there's nothing to change, after "All N photo files on <branch>". */
  nothing: string;
  /** What happens to the changed files, after "N of M photo files". */
  headline: string;
  children: ReactNode;
}) {
  if (changed === 0) {
    return (
      <>
        <p className="text-sm">
          All {count(scan.photoFiles, "photo file")} on <code>{scan.branch}</code> {nothing}.
        </p>
        <Unreadable files={scan.unreadable} />
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <strong>
            {changed} of {count(scan.photoFiles, "photo file")}
          </strong>{" "}
          {headline}.
        </p>
        <p className="text-muted-foreground">
          <PreviewDestination scan={scan} />
        </p>
      </div>
      <Unreadable files={scan.unreadable} blocking />
      {children}
    </>
  );
}

/** A bulk change's save button, with a spinner while it saves and the error under it. */
export function SaveButton({
  label,
  disabled,
  pending,
  error,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  pending: boolean;
  error: Error | null;
  onClick: () => void;
  /** Shown beside the button, such as what it leaves out. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={disabled || pending} onClick={onClick}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          label
        )}
      </Button>
      {children}
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </div>
  );
}
