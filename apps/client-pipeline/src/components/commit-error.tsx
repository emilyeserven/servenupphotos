import { type GitHubFailure, githubFailureOf } from "@/api/errors";
import { JsonCodeBlock } from "@/components/json-code-block";
import { cn } from "@/lib/utils";

/**
 * Why Commit failed: the message, and when a GitHub call failed, what GitHub answered, open, so
 * the failing step, the request and GitHub's own errors can be read and copied.
 */
export function CommitError({ error, className }: { error: Error; className?: string }) {
  const github = githubFailureOf(error);
  return (
    <span className={cn("flex min-w-0 flex-col items-start gap-2", className)}>
      <span className="text-destructive">{error.message}</span>
      {github && <GitHubFailureDetails failure={github} />}
    </span>
  );
}

/** GitHub's answer to the call that failed, as a summary and the whole answer as JSON. */
function GitHubFailureDetails({ failure }: { failure: GitHubFailure }) {
  return (
    <details open className="w-full min-w-0 text-sm">
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
