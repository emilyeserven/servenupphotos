import { useNavigate } from "@tanstack/react-router";
import { FlagIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { untitledLosers, useCompareEdits } from "@/hooks/use-compare-groups";
import { type CompareGroup, comparePhotoName, winnerOf } from "@/lib/compare-groups";

/** What finishing does to the winner, or that there's none. */
function winnerNote(group: CompareGroup): string {
  const winner = winnerOf(group);
  return winner
    ? `“${comparePhotoName(winner)}” won. Give it a title on the Photo page to post it, if it doesn't have one.`
    : "No winner is picked, so every photo just leaves the group.";
}

/**
 * Finish comparing: after asking, takes every photo out of the group, and can set the untitled
 * photos that didn't win aside in the Undecided queue. Photos with a title stay as they are.
 */
export function FinishComparing({ group }: { group: CompareGroup }) {
  const [open, setOpen] = useState(false);
  const losers = winnerOf(group) ? untitledLosers(group) : [];
  const [setAside, setSetAside] = useState(true);
  const { finish } = useCompareEdits();
  const navigate = useNavigate();
  const done = () => {
    finish(group, setAside && losers.length > 0);
    setOpen(false);
    void navigate({ to: "/compare" });
  };
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FlagIcon />
        Finish comparing
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish “{group.name}”?</DialogTitle>
            <DialogDescription>
              Takes all {group.photos.length} photos out of the group. {winnerNote(group)} Photos
              with a title stay as they are, on the portfolio or in flight.
            </DialogDescription>
          </DialogHeader>
          {losers.length > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                checked={setAside}
                onChange={(e) => setSetAside(e.target.checked)}
              />
              <span>
                Set the{" "}
                {losers.length === 1 ? "untitled photo" : `${losers.length} untitled photos`} that
                didn&apos;t win aside as Undecided
              </span>
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep comparing
            </Button>
            <Button onClick={done}>Finish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
