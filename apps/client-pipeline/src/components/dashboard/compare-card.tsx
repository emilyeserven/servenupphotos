import { Link } from "@tanstack/react-router";
import { TrophyIcon } from "lucide-react";
import type { CompareRead } from "@/components/compare/compare-group-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type CompareGroup, winnersOf } from "@/lib/compare-groups";

/** The compare groups still open, each linked to its head-to-head view. */
export function CompareCard({ compare }: { compare: CompareRead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link to="/compare" className="hover:underline">
            Open Compare sets
          </Link>
        </CardTitle>
        <CardDescription>Groups waiting for you to pick a winner and finish.</CardDescription>
      </CardHeader>
      <CardContent>
        <GroupList compare={compare} />
      </CardContent>
    </Card>
  );
}

function GroupList({ compare }: { compare: CompareRead }) {
  if (compare.pending) return <Skeleton className="h-20 rounded-md" />;
  if (compare.groups.length === 0) {
    return <p className="text-muted-foreground text-sm">No compare groups are open.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {compare.groups.map((group) => (
        <li key={group.name}>
          <GroupRow group={group} />
        </li>
      ))}
    </ul>
  );
}

/** A group's name, photo count and how many winners are picked. */
function GroupRow({ group }: { group: CompareGroup }) {
  const winners = winnersOf(group).length;
  const count = group.photos.length;
  return (
    <Link
      to="/compare"
      search={{ group: group.name }}
      className="hover:bg-muted/40 flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
    >
      <span className="truncate font-medium">{group.name}</span>
      <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
        {count === 1 ? "1 photo" : `${count} photos`}
        {winners > 0 && (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <TrophyIcon className="size-3.5" aria-hidden />
            {winners}
          </span>
        )}
      </span>
    </Link>
  );
}
