import { type CloudflareResponse, cloudflareFailureOf } from "@/api/errors";
import { CopyTextButton } from "@/components/copy-text";

/**
 * Cloudflare's answer to the R2 request behind error, for looking up a failure its plain-language
 * reason doesn't explain: a one-line summary that opens to the status, S3 code, CF-Ray and request
 * IDs, the request and the whole error, with a Copy button. Nothing for other failures.
 */
export function CloudflareFailureDetails({ error }: { error: unknown }) {
  const failure = cloudflareFailureOf(error);
  if (!failure) return null;
  const rows = cloudflareRows(failure.response, failure.pipeline);
  const text = [...rows.map(([label, value]) => `${label}: ${value}`), failure.response.error].join(
    "\n",
  );
  return (
    <details className="w-full min-w-0 text-sm">
      <summary className="text-muted-foreground cursor-pointer">
        Cloudflare&apos;s answer: {summaryOf(failure.response)}
      </summary>
      <div className="bg-muted/40 mt-2 flex flex-col gap-2 rounded-lg border p-3 text-xs">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 font-mono break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <pre className="text-muted-foreground font-mono break-all whitespace-pre-wrap">
          {failure.response.error}
        </pre>
        <CopyTextButton label="Copy details" title="Cloudflare's answer" text={() => text} />
      </div>
    </details>
  );
}

/** The summary line, such as "500 InternalError, after 3 tries", or "no answer" when none came. */
function summaryOf(r: CloudflareResponse): string {
  const answer = [r.status, r.code].filter(Boolean).join(" ") || "no answer";
  return r.attempts && r.attempts > 1 ? `${answer}, after ${r.attempts} tries` : answer;
}

/** Each label with its value, leaving out what wasn't known. */
function cloudflareRows(r: CloudflareResponse, pipeline: string | undefined): [string, string][] {
  const rows: [string, string | number | undefined][] = [
    ["Status", r.status],
    ["Code", r.code],
    ["Message", r.message],
    ["Operation", r.operation],
    ["Request", r.request],
    ["Tries", r.attempts],
    ["CF-Ray", r.ray],
    ["Request ID", r.requestId],
    ["Pipeline", pipeline],
  ];
  return rows.flatMap(([label, value]) => (value ? [[label, String(value)]] : []));
}
