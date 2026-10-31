import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { type CompareRead, ReadProblems } from "@/components/compare/compare-group-list";
import { ComparePhotoCard } from "@/components/compare/compare-photo-card";
import { FinishComparing } from "@/components/compare/finish-comparing";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type CompareGroup, photoNames, winnersOf } from "@/lib/compare-groups";
import { cn } from "@/lib/utils";

/** Columns for a group of two, or three for a larger one, so photos sit side by side. */
function columns(count: number): string {
  return count <= 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3";
}

/**
 * The compare group named name, its photos side by side to pick the winner from, with Finish
 * comparing; or a note when no photo is in it.
 */
export function CompareGroupView({ name, compare }: { name: string; compare: CompareRead }) {
  if (compare.pending) return <Skeleton className="h-96 rounded-xl" />;
  const group = compare.groups.find((candidate) => candidate.name === name);
  return (
    <>
      <ReadProblems problems={compare.problems} />
      {group ? <GroupPhotos group={group} /> : <EmptyGroup name={name} />}
    </>
  );
}

function GroupPhotos({ group }: { group: CompareGroup }) {
  return (
    <>
      <GroupHeader group={group} />
      <ul className={cn("grid items-start gap-4", columns(group.photos.length))}>
        {group.photos.map((photo) => (
          <li key={photo.file.path} className="h-full">
            <ComparePhotoCard photo={photo} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Who won, or that none is picked yet. */
function winnerText(group: CompareGroup): string {
  const winners = winnersOf(group);
  if (winners.length === 0)
    return "Pick the photo to post, or several. Clicking a winner again unpicks it.";
  const label = winners.length === 1 ? "Winner" : "Winners";
  return `${label}: ${photoNames(winners)}. Finish comparing once you're sure.`;
}

function GroupHeader({ group }: { group: CompareGroup }) {
  const count = group.photos.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{count === 1 ? "1 photo" : `${count} photos`} head-to-head</CardTitle>
        <CardDescription>{winnerText(group)}</CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-2">
          <BackButton />
          <FinishComparing group={group} />
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function BackButton() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/compare">
        <ArrowLeftIcon />
        All groups
      </Link>
    </Button>
  );
}

function EmptyGroup({ name }: { name: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-xl border border-dashed p-6 text-sm">
      <p>
        No photo is in “{name}”. It may have been finished, or its photos moved to other groups.
      </p>
      <BackButton />
    </div>
  );
}
