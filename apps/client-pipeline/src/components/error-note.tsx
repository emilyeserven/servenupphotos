import { type GitHubFailure, githubFailureOf } from "@/api/errors";
import { JsonCodeBlock } from "@/components/json-code-block";
import { cn } from "@/lib/utils";

/** What went wrong: an Error from a failed request or read, or a sentence written for the page. */
type ErrorLike = Error | string;

interface ErrorNoteProps {
  /** What failed. Nothing is shown when it's null, undefined or an empty string. */
  error: ErrorLike | null | undefined;
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
export function ErrorNote({ error, githubOpen = false, className }: ErrorNoteProps) {
  if (!error) return null;
  const message = typeof error === "string" ? error : error.message;
  const github = githubFailureOf(error);
  return (
    <span role="alert" className={cn("flex min-w-0 flex-col items-start gap-2 text-sm", className)}>
      <span className="text-destructive">{message}</span>
      {github && <GitHubFailureDetails failure={github} open={githubOpen} />}
    </span>
  );
}

/** GitHub's answer to the call that failed, as a summary and the whole answer as JSON. */
function GitHubFailureDetails({ failure, open }: { failure: GitHubFailure; open: boolean }) {
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
