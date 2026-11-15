import { ChevronsDownIcon } from "lucide-react";
import { LOWER_TIER_HELP, useSetLowerTier } from "@/components/lower-tier";
import { Button } from "@/components/ui/button";
import type { ComparePhoto } from "@/lib/compare-groups";
import { isLowerTier } from "@/lib/lower-tier";
import { cn } from "@/lib/utils";

/**
 * Marks a compare group's photo Lower Tier, or takes the mark off when it has it, as a change
 * waiting for Commit. It stays in the group either way.
 */
export function LowerTierButton({ photo }: { photo: ComparePhoto }) {
  const setLowerTier = useSetLowerTier();
  const lowerTier = isLowerTier(photo.data);
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn(
        lowerTier &&
          "border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-300",
      )}
      aria-pressed={lowerTier}
      title={lowerTier ? "Take the Lower Tier mark off" : `Mark it Lower Tier: ${LOWER_TIER_HELP}`}
      onClick={() => setLowerTier([photo.file], !lowerTier)}
    >
      <ChevronsDownIcon />
      Lower Tier
    </Button>
  );
}
