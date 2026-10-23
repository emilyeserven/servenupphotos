import { Link } from "@tanstack/react-router";
import { ClockIcon } from "lucide-react";
import type { InFlightResponse } from "@/api/photos";
import { CommitButton } from "@/components/all-photos-rebuild";

/** A file on Photos in Flight: its name, linked to its page on GitHub once it's committed there. */
export function FileLink({ fileUrl, name }: { fileUrl: string; name: string }) {
  return (
    <a
      href={fileUrl || undefined}
      target="_blank"
      rel="noreferrer"
      className="underline-offset-4 [&[href]]:hover:underline"
    >
      {name}
    </a>
  );
}

/** How a file changes, such as `added`, and whether that change is still waiting for Commit. */
export function FileStatus({ status, pending }: { status: string; pending?: boolean }) {
  return (
    <>
      <span className="text-muted-foreground font-normal">{status}</span>
      {pending && (
        <span
          className="flex items-center gap-1 font-normal text-amber-700 dark:text-amber-400 [&_svg]:size-3.5"
          title="Saved in the app only. Commit sends it to GitHub."
        >
          <ClockIcon aria-hidden />
          Waiting for Commit
        </span>
      )}
    </>
  );
}

/** How many files have changes waiting for Commit. */
function pendingCount(data: InFlightResponse): number {
  const groups = [data.albums, data.tags, data.places, data.localizations, data.metainfo];
  const files = [...data.files, ...groups.flatMap((group) => group.files)];
  return files.filter((file) => file.pending).length;
}

/**
 * What Photos in Flight says with no photo data pull request open: the changes waiting for Commit,
 * which opens one, or how to start.
 */
export function NoPullRequest({ data }: { data: InFlightResponse }) {
  const count = pendingCount(data);
  if (count === 0) {
    return (
      <p className="text-muted-foreground">
        No open pull request titled “Add photo data”, and nothing is waiting for Commit. Saving a
        photo from{" "}
        <Link to="/exif" className="text-foreground underline underline-offset-4">
          Photo
        </Link>{" "}
        keeps it here until you commit.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-amber-700 dark:text-amber-400">
        {count === 1 ? "1 file is" : `${count} files are`} waiting for Commit, which opens the “Add
        photo data” pull request with them. Nothing is on GitHub until then.
      </p>
      <CommitButton />
    </div>
  );
}
