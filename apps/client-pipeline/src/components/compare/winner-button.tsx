import { TrophyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompareEdits } from "@/hooks/use-compare-groups";
import { type ComparePhoto, isWinner } from "@/lib/compare-groups";
import { withShortcut } from "@/lib/compare-keys";

const PICKED = { variant: "default", title: "Unpick it", label: "Winner" } as const;
const UNPICKED = {
  variant: "outline",
  title: "Pick it to post; a group can have several winners",
  label: "Pick as winner",
} as const;

/**
 * Picks the photo as one of its compare group's winners, or unpicks it when it is one. shortcut is
 * the key that does the same, shown in its title.
 */
export function WinnerButton({ photo, shortcut }: { photo: ComparePhoto; shortcut?: string }) {
  const { setWinner } = useCompareEdits();
  const winner = isWinner(photo);
  const look = winner ? PICKED : UNPICKED;
  return (
    <Button
      size="sm"
      variant={look.variant}
      aria-pressed={winner}
      aria-keyshortcuts={shortcut}
      title={withShortcut(look.title, shortcut)}
      onClick={() => setWinner(photo, !winner)}
    >
      <TrophyIcon />
      {look.label}
    </Button>
  );
}
