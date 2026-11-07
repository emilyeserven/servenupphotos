import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";

/**
 * The end of a save's message: what was saved waits in the app for Commit, which sends it to the
 * open photo data pull request, or opens one when none is open. Nothing is on GitHub before that.
 */
export function WaitingForCommit({
  pullRequestUrl,
  what = "It",
}: {
  /** The open photo data pull request; unset when Commit will open one. */
  pullRequestUrl?: string;
  /** What was saved, starting the sentence, such as "They". */
  what?: string;
}) {
  return (
    <>
      {what} {what === "It" ? "waits" : "wait"} for{" "}
      <Link to="/in-flight" className="underline underline-offset-4">
        Commit
      </Link>
      , which <CommitTarget url={pullRequestUrl} />.
    </>
  );
}

function CommitTarget({ url }: { url?: string }) {
  if (!url) return <>opens the “Add photo data” pull request</>;
  return (
    <>
      sends it to{" "}
      <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        the open pull request
      </a>
    </>
  );
}

/**
 * A card's line after a save: what it saved waits in the app for Commit, with a check beside it.
 * `what` names it, such as "the rules".
 */
export function SavedInApp({ what, pullRequestUrl }: { what: string; pullRequestUrl?: string }) {
  return (
    <p className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>
        Saved {what} in the app. <WaitingForCommit pullRequestUrl={pullRequestUrl} />
      </span>
    </p>
  );
}
