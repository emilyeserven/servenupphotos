import { Link } from "@tanstack/react-router";
import { ImageIcon, ScaleIcon, TrophyIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { useCompareGroups } from "@/hooks/use-compare-groups";
import {
  type CompareGroup,
  type ComparePhoto,
  comparePhotoName,
  isWinner,
  winnerOf,
} from "@/lib/compare-groups";
import { squareImages } from "@/lib/offline-thumbnails";
import { cn } from "@/lib/utils";

/** The photos and compare groups, as `useCompareGroups` reads them. */
export type CompareRead = ReturnType<typeof useCompareGroups>;

/** How many tiles a group's card previews. */
const PREVIEW_COUNT = 4;

/** Every compare group as a card with its first photos, opening it head-to-head, or how to start one. */
export function CompareGroupList({ compare }: { compare: CompareRead }) {
  if (compare.pending) return <ListSkeleton />;
  return (
    <>
      <ReadProblems problems={compare.problems} />
      {compare.groups.length === 0 ? (
        <NoGroups />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {compare.groups.map((group) => (
            <li key={group.name}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Why the Gallery's or Photos in Flight's photos couldn't be read, so their groups may be missing. */
export function ReadProblems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <div className="text-destructive flex flex-col gap-1 text-sm">
      {problems.map((problem) => (
        <p key={problem}>Couldn&apos;t read every photo: {problem}</p>
      ))}
    </div>
  );
}

function NoGroups() {
  return (
    <div className="text-muted-foreground flex flex-col gap-2 rounded-xl border border-dashed p-6 text-sm">
      <p className="text-foreground font-medium">No compare groups yet</p>
      <p>
        Use <ScaleIcon className="inline size-4 align-text-bottom" aria-label="Compare" /> Compare
        on a photo in the{" "}
        <Link to="/gallery" className="text-foreground underline underline-offset-4">
          Gallery
        </Link>{" "}
        or{" "}
        <Link to="/in-flight" className="text-foreground underline underline-offset-4">
          Photos in Flight
        </Link>{" "}
        to put it in a group, then open the group here to weigh its photos side by side.
      </p>
    </div>
  );
}

/** A group's name, photo count, winner, and its first photos, linked to the group. */
function GroupCard({ group }: { group: CompareGroup }) {
  const count = group.photos.length;
  return (
    <Link
      to="/compare"
      search={{ group: group.name }}
      className="focus-visible:ring-ring block h-full rounded-xl outline-none focus-visible:ring-2"
    >
      <Card className="hover:bg-muted/40 h-full transition-colors">
        <CardHeader>
          <CardTitle className="truncate">{group.name}</CardTitle>
          <CardDescription>
            {count === 1 ? "1 photo" : `${count} photos`}
            <WinnerLine group={group} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-4 gap-2">
            {group.photos.slice(0, PREVIEW_COUNT).map((photo) => (
              <li key={photo.file.path}>
                <PreviewTile photo={photo} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Link>
  );
}

/** The winner's name, after the count, when one is picked. */
function WinnerLine({ group }: { group: CompareGroup }) {
  const winner = winnerOf(group);
  if (!winner) return <>, no winner yet</>;
  return (
    <span className="mt-1 flex items-center gap-1 text-amber-700 dark:text-amber-400">
      <TrophyIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{comparePhotoName(winner)}</span>
    </span>
  );
}

/** The photo's Square Thumbnail from the offline copy, outlined when it's the winner. */
function PreviewTile({ photo }: { photo: ComparePhoto }) {
  const square = photo.imageUrl && squareImages(photo.data, photo.imageUrl);
  return (
    <span
      className={cn(
        "bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-md border",
        isWinner(photo) && "ring-2 ring-amber-500",
      )}
    >
      {square ? (
        <img src={square.square} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageIcon className="text-muted-foreground size-5" aria-hidden />
      )}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}
