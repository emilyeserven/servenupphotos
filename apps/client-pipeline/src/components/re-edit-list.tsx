import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ReadProblems } from "@/components/compare/compare-group-list";
import { PhotoRow } from "@/components/quality-check/photo-parts";
import { ReadingNote } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompareGroups } from "@/hooks/use-compare-groups";
import { type AutogroupPhoto, autogroupPhotos } from "@/lib/compare-autogroup";
import { type MarkedPhoto, markedPhotos } from "@/lib/re-edit";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/**
 * The Re-edit page's list: every photo marked for re-editing, from the Gallery and Photos in
 * Flight with their local edits, most recently marked first, each with its reason, the day it was
 * marked, and a link to replace its image on the Photo page.
 */
export function ReEditList() {
  const compare = useCompareGroups();
  const marked = useMemo(
    () =>
      markedPhotos(
        autogroupPhotos(compare.photos, { scope: "all", skipGrouped: false }),
        (entry) => entry.photo.data,
      ),
    [compare.photos],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marked for re-editing</CardTitle>
        <CardDescription>
          Photos marked with Re-edit in Photos in Flight or on the Photo page, or flagged by Quality
          Check. Replacing a photo&apos;s image takes the mark off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ReadProblems problems={compare.problems} />
        {compare.pending ? (
          <ReadingNote label="Reading the photos…" />
        ) : (
          <MarkedList marked={marked} />
        )}
      </CardContent>
    </Card>
  );
}

/** How many photos are marked, then the list, or a note that none are. */
function MarkedList({ marked }: { marked: MarkedPhoto<AutogroupPhoto>[] }) {
  if (marked.length === 0) {
    return (
      <EmptyNote>
        No photos are marked for re-editing. Mark one with <strong>Re-edit</strong> in{" "}
        <Link to="/in-flight" className="underline">
          Photos in Flight
        </Link>
        , or run Quality Check.
      </EmptyNote>
    );
  }
  return (
    <>
      <p className="text-sm">{count(marked.length, "photo")} marked for re-editing.</p>
      <ul className="flex flex-col divide-y rounded-xl border">
        {marked.map((item) => (
          <MarkedRow key={item.entry.key} item={item} />
        ))}
      </ul>
    </>
  );
}

/** One marked photo: its Small version, name, reason, where it is and the day it was marked. */
function MarkedRow({ item }: { item: MarkedPhoto<AutogroupPhoto> }) {
  return (
    <PhotoRow entry={item.entry} section="image">
      <Reason reason={item.reEdit.reason} />
      <p className="text-muted-foreground text-xs">{markedText(item)}</p>
    </PhotoRow>
  );
}

/** Why the photo needs editing again, or a faint note that no reason was given. */
function Reason({ reason }: { reason: string }) {
  if (!reason) return <EmptyNote>No reason given</EmptyNote>;
  return <p>{reason}</p>;
}

/** Where the photo is and the day it was marked, such as "In the portfolio · marked 2026-10-23". */
function markedText({ entry, reEdit }: MarkedPhoto<AutogroupPhoto>): string {
  const where = entry.photo.fromGallery ? "In the portfolio" : "In the pull request";
  return reEdit.date ? `${where} · marked ${reEdit.date}` : where;
}
