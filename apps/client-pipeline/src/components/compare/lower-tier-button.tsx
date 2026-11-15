import { ChevronsDownIcon } from "lucide-react";
import { LOWER_TIER_HELP, useSetLowerTier } from "@/components/lower-tier";
import { Button } from "@/components/ui/button";
import type { ComparePhoto } from "@/lib/compare-groups";
import { withShortcut } from "@/lib/compare-keys";
import { isLowerTier } from "@/lib/lower-tier";
import { cn } from "@/lib/utils";

/**
 * Marks a compare group's photo Lower Tier, or takes the mark off when it has it, as a change
 * waiting for Commit. It stays in the group either way. shortcut is the key that does the same,
 * shown in its title.
 */
export function LowerTierButton({ photo, shortcut }: { photo: ComparePhoto; shortcut?: string }) {
  const setLowerTier = useSetLowerTier();
  const lowerTier = isLowerTier(photo.data);
  const title = lowerTier
    ? "Take the Lower Tier mark off"
    : `Mark it Lower Tier: ${LOWER_TIER_HELP}`;
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn(
        lowerTier &&
          "border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-300",
      )}
      aria-pressed={lowerTier}
      aria-keyshortcuts={shortcut}
      title={withShortcut(title, shortcut)}
      onClick={() => setLowerTier([photo.file], !lowerTier)}
    >
      <ChevronsDownIcon />
      Lower Tier
    </Button>
  );
}
