import { useMutation } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { type NearDuplicatesResult, findNearDuplicatesMutation } from "@/api/near-duplicates";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * **Find near duplicates**: has the backend look through every saved photo and put the ones that
 * look nearly the same, such as frames of a burst, in compare groups, then says what it did.
 */
export function FindNearDuplicates() {
  const find = useMutation(findNearDuplicatesMutation);
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-prose">
          Look through every saved photo for ones that look nearly the same, such as frames of a
          burst or a re-export, and put each set in a compare group. Photos already in a group stay
          in it.
        </p>
        <Button variant="outline" disabled={find.isPending} onClick={() => find.mutate()}>
          {find.isPending ? <Spinner /> : <CopyIcon aria-hidden />}
          Find near duplicates
        </Button>
      </div>
      {find.error && <p className="text-destructive">{find.error.message}</p>}
      {find.data && <FoundLine result={find.data} />}
    </div>
  );
}

/** What a run found, and how many photos it couldn't check. */
function FoundLine({ result }: { result: NearDuplicatesResult }) {
  const photos = result.groups.reduce((sum, group) => sum + group.paths.length, 0);
  const groups = result.groups.length;
  return (
    <p>
      {groups === 0
        ? `No new near duplicates among ${result.photos} photos.`
        : `Put ${photos} photos in ${groups === 1 ? "1 compare group" : `${groups} compare groups`}, waiting for Commit.`}
      {result.hashFailed > 0 &&
        ` ${result.hashFailed} couldn't be checked because their Small version couldn't be read.`}
    </p>
  );
}
