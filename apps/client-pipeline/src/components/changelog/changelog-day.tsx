import { GitCommitHorizontalIcon, GitPullRequestIcon } from "lucide-react";
import type { ChangelogEntry } from "@/api/changelog";
import type { ChangelogDay } from "@/components/changelog/days";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

/** One day of the Changelog: a card with the day's changes, each linking to its pull request and commit. */
export function ChangelogDayCard({ day }: { day: ChangelogDay }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <time dateTime={day.day}>{dayFormat.format(new Date(`${day.day}T00:00`))}</time>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {day.entries.map((entry) => (
            <ChangelogRow key={entry.sha} entry={entry} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** One change: its title, then its pull request, commit, author and time. */
function ChangelogRow({ entry }: { entry: ChangelogEntry }) {
  return (
    <li className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
      <p className="text-sm font-medium">{entry.title}</p>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <PullRequestLink entry={entry} />
        <a
          href={entry.commitUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono hover:underline"
        >
          <GitCommitHorizontalIcon className="size-3.5" aria-hidden />
          {entry.sha.slice(0, 7)}
        </a>
        <span>{entry.author}</span>
        <time dateTime={entry.date}>{timeFormat.format(new Date(entry.date))}</time>
      </p>
    </li>
  );
}

/** The link to the pull request the change merged, or nothing when it was pushed straight to the branch. */
function PullRequestLink({ entry }: { entry: ChangelogEntry }) {
  if (!entry.pullRequestUrl) return null;
  return (
    <a
      href={entry.pullRequestUrl}
      target="_blank"
      rel="noreferrer"
      className="text-primary inline-flex items-center gap-1 hover:underline"
    >
      <GitPullRequestIcon className="size-3.5" aria-hidden />#{entry.pullRequest}
    </a>
  );
}
