import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { CommittedChange, ScannedPhotos } from "@/api/data";

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

/** Where a previewed change will be committed. */
export function PreviewDestination({ scan }: { scan: ScannedPhotos }) {
  if (!scan.pullRequest) {
    return (
      <>
        It&apos;s saved as one commit on a new photo-data branch, in a new &quot;Add photo
        data&quot; pull request against <code>{scan.branch}</code>.
      </>
    );
  }
  return (
    <>
      It&apos;s saved as one commit on <code>{scan.branch}</code>, in{" "}
      <ExternalLink href={scan.pullRequest.url}>
        pull request #{scan.pullRequest.number}
      </ExternalLink>
      .
    </>
  );
}

/** What a change did, then where it was committed. */
export function CommitSuccess({
  result,
  children,
}: {
  result: CommittedChange;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-t pt-6 text-sm">
      <p>
        {children}, in <ExternalLink href={result.commitUrl}>one commit</ExternalLink> on{" "}
        <code>{result.branch}</code>.
      </p>
      <p className="text-muted-foreground">
        {result.newPullRequest ? "It opened " : "It's in "}
        <ExternalLink href={result.pullRequestUrl}>
          pull request #{result.pullRequestNumber}
        </ExternalLink>
        , where CI rebuilds ALLPHOTOS.json. The portfolio uses the change once it&apos;s merged.
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
