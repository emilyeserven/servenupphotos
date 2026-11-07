import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DashboardPhotoTile } from "@/components/dashboard/photo-tile";
import { Segmented } from "@/components/lightroom-albums/segmented";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompareRead } from "@/components/compare/compare-group-list";
import type { ComparePhoto } from "@/lib/compare-groups";
import { isCasual, isSetAside, isUnselected, titleOf, useUntitledDrafts } from "@/lib/drafts";
import { photoId } from "@/lib/unselected";

/** How the card picks its 3 drafts. */
type DraftPick = "random" | "newest" | "oldest";

const PICKS: { value: DraftPick; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

/** How many drafts the card shows. */
const SHOWN = 3;

/** Whether the photo is done with as a draft: unselected in a compare group, or a casual photo. */
function isDone(data: unknown): boolean {
  return isUnselected(data) || isCasual(data);
}

/**
 * Whether the photo is a draft right now: set aside as Undecided, or untitled while untitled photos
 * are kept as drafts. Unselected and casual photos are left out, since they're done with.
 */
function isCurrentDraft(photo: ComparePhoto, untitledDrafts: boolean): boolean {
  if (isDone(photo.data)) return false;
  return isSetAside(photo.data) || (untitledDrafts && titleOf(photo.data) === undefined);
}

/** A number from the path and seed, the same every time, to shuffle by. */
function scramble(path: string, seed: number): number {
  let hash = seed;
  for (const char of path) hash = Math.imul(hash ^ char.charCodeAt(0), 2654435761);
  return hash >>> 0;
}

/** Drafts get their photo ID as their file is made, so a higher ID is a newer draft. */
function byId(a: ComparePhoto, b: ComparePhoto): number {
  return (photoId(a) ?? 0) - (photoId(b) ?? 0);
}

/** The 3 drafts the pick shows; seed reshuffles the random ones. */
function pickDrafts(drafts: ComparePhoto[], pick: DraftPick, seed: number): ComparePhoto[] {
  const sorted =
    pick === "random"
      ? drafts.toSorted((a, b) => scramble(a.file.path, seed) - scramble(b.file.path, seed))
      : drafts.toSorted(byId);
  return (pick === "newest" ? sorted.toReversed() : sorted).slice(0, SHOWN);
}

/** 3 photos that are drafts right now, at random by default, or the newest or oldest. */
export function DraftsCard({ compare }: { compare: CompareRead }) {
  const untitledDrafts = useUntitledDrafts();
  const [pick, setPick] = useState<DraftPick>("random");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const drafts = useMemo(
    () => compare.photos.filter((photo) => isCurrentDraft(photo, untitledDrafts)),
    [compare.photos, untitledDrafts],
  );
  const choose = (next: DraftPick) => {
    if (next === "random") setSeed((s) => s + 1);
    setPick(next);
  };
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>
            <Link to="/in-flight" className="hover:underline">
              Drafts
            </Link>
          </CardTitle>
          <CardDescription>{draftCount(drafts.length, compare.pending)}</CardDescription>
        </div>
        <Segmented label="Which drafts" options={PICKS} value={pick} onChange={choose} />
      </CardHeader>
      <CardContent>
        <DraftTiles pending={compare.pending} drafts={pickDrafts(drafts, pick, seed)} />
      </CardContent>
    </Card>
  );
}

/** How many drafts there are, not on the portfolio until they're named. */
function draftCount(count: number, pending: boolean): string {
  if (pending) return "Reading the photos…";
  if (count === 0) return "No drafts right now.";
  return `${count === 1 ? "1 draft" : `${count} drafts`}, not on the portfolio until named.`;
}

function DraftTiles({ pending, drafts }: { pending: boolean; drafts: ComparePhoto[] }) {
  if (pending) return <TileSkeletons />;
  if (drafts.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-3">
      {drafts.map((photo) => (
        <li key={photo.file.path} className="min-w-0">
          <DashboardPhotoTile photo={photo} />
        </li>
      ))}
    </ul>
  );
}

/** Three square placeholders while the photos are read. */
function TileSkeletons() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="aspect-square rounded-md" />
      ))}
    </div>
  );
}
