import type { ReactNode } from "react";

import { type GitHubFailure, githubFailureOf } from "@/api/errors";
import { JsonCodeBlock } from "@/components/json-code-block";
import { cn } from "@/lib/utils";

/** What went wrong: an Error from a failed request or read, or a sentence written for the page. */
type ErrorLike = Error | string;

interface ErrorNoteProps {
  /** What failed. Nothing is shown when it's null, undefined or an empty string and there are no children. */
  error?: ErrorLike | null;
  /** Words before the message that say what was being done, such as "Couldn't commit ALLPHOTOS.json:". */
  lead?: string;
  /** Shown in place of the message, for a failure that needs more than a sentence, such as a list of files. */
  children?: ReactNode;
  /** The note's id, for a field's `aria-describedby`. */
  id?: string;
  /** Whether GitHub's answer starts open, as on the Commit button where it's what to read next. */
  githubOpen?: boolean;
  /** Extra classes, such as `text-xs` beside small buttons or a grid column. */
  className?: string;
}

/**
 * The one way the pipeline shows that something failed: the message in red, announced to screen
 * readers, and when a GitHub call failed, GitHub's own answer under it (the failing step, the
 * request and GitHub's errors) so it can be read and copied.
 */
export function ErrorNote({
  error,
  lead,
  children,
  id,
  githubOpen = false,
  className,
}: ErrorNoteProps) {
  if (!error && !children) return null;
  return (
    <span
      id={id}
      role="alert"
      className={cn("flex min-w-0 flex-col items-start gap-2 text-sm", className)}
    >
      <span className="text-destructive flex flex-col gap-1">
        {children ?? messageOf(error, lead)}
      </span>
      <GitHubFailureDetails error={error} open={githubOpen} />
    </span>
  );
}

/** The message to show: the error's own words, after the lead when there is one. */
function messageOf(error: ErrorLike | null | undefined, lead: string | undefined): string {
  const message = typeof error === "string" ? error : error?.message;
  return [lead, message].filter(Boolean).join(" ");
}

/** GitHub's answer to the call that failed, as a summary and the whole answer as JSON; nothing for other failures. */
function GitHubFailureDetails({ error, open }: { error: ErrorNoteProps["error"]; open: boolean }) {
  const failure = githubFailureOf(error);
  if (!failure) return null;
  return (
    <details open={open} className="w-full min-w-0 text-sm">
      <summary className="text-muted-foreground cursor-pointer">GitHub&apos;s answer</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {failureRows(failure).map(([label, value]) => (
          <FailureRow key={label} label={label} value={value} />
        ))}
      </dl>
      <div className="mt-2">
        <JsonCodeBlock value={failure} title="GitHub error" contentClassName="max-h-80" />
      </div>
    </details>
  );
}

function FailureRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-mono break-all whitespace-pre-wrap">{value}</dd>
    </>
  );
}

/** The summary's rows: each label with its value, leaving out what GitHub didn't send. */
function failureRows(f: GitHubFailure): [string, string][] {
  const rows: [string, string | undefined][] = [
    ["Step", f.step],
    ["Request", `${f.method} ${f.path}`],
    ["Status", String(f.status)],
    ["Message", f.message],
    ["Errors", errorsText(f.errors)],
    ["Docs", f.documentationUrl],
    ["Request ID", f.requestId],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

/** GitHub's errors as text, one per line, or undefined when there are none. */
function errorsText(errors: unknown[] | undefined): string | undefined {
  if (!errors?.length) return undefined;
  return errors.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n");
}
