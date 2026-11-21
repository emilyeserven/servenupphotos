import { ChevronsDownIcon, ChevronsUpIcon } from "lucide-react";
import type { PublishedFile } from "@/api/photos";
import { BulkMarkCard } from "@/components/gallery/bulk-mark-card";
import { LOWER_TIER_HELP, useSetLowerTier } from "@/components/lower-tier";

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
  return (
    <BulkMarkCard
      files={files}
      selection={selection}
      title="Lower Tier"
      description={`${LOWER_TIER_HELP} The Gallery hides Lower Tier photos until Show → Lower Tier is on.`}
      markLabel={(photos) => `Mark ${photos} Lower Tier`}
      markIcon={<ChevronsDownIcon />}
      clearLabel="Take the mark off"
      clearIcon={<ChevronsUpIcon />}
      doneMessage={(marked, photos) => `${marked ? "Marked" : "Took the mark off"} ${photos}.`}
      setMark={setLowerTier}
    />
  );
}
