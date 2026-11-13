import { CheckIcon, ChevronsDownIcon, ChevronsUpIcon } from "lucide-react";
import { useState } from "react";
import type { PublishedFile } from "@/api/photos";
import { LOWER_TIER_HELP, useSetLowerTier } from "@/components/lower-tier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectProblem } from "@/components/gallery/published-file";

interface BulkLowerTierProps {
  files: PublishedFile[];
  selection: ReadonlySet<string>;
}

/**
 * Marks every chosen photo Lower Tier, or takes the mark off, as changes waiting for Commit. The
 * selection stays, so the same photos can be given albums and tags too.
 */
export function BulkLowerTier({ files, selection }: BulkLowerTierProps) {
  const setLowerTier = useSetLowerTier();
  const [done, setDone] = useState<string>();
  const chosen = files.filter((file) => selection.has(file.path) && !selectProblem(file));
  const set = (lowerTier: boolean) => {
    setLowerTier(chosen, lowerTier);
    setDone(
      `${lowerTier ? "Marked" : "Took the mark off"} ${count(chosen.length)}. The change waits for Commit.`,
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lower Tier</CardTitle>
        <CardDescription>
          {LOWER_TIER_HELP} The Gallery hides Lower Tier photos until its Lower Tier filter shows
          them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button disabled={chosen.length === 0} onClick={() => set(true)}>
            <ChevronsDownIcon />
            Mark {count(chosen.length)} Lower Tier
          </Button>
          <Button variant="outline" disabled={chosen.length === 0} onClick={() => set(false)}>
            <ChevronsUpIcon />
            Take the mark off
          </Button>
        </div>
        {done && (
          <p className="flex items-start gap-2" aria-live="polite">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{done}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function count(n: number): string {
  return n === 1 ? "1 photo" : `${n} photos`;
}
