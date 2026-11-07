import { FlagIcon } from "lucide-react";
import { useState } from "react";
import { LosersOptions, type LosersForm } from "@/components/compare/losers-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { untitledLosers } from "@/hooks/use-compare-groups";
import type { DiscardFailure } from "@/hooks/use-discard-images";
import { useFinishGroup } from "@/hooks/use-finish-group";
import { type CompareGroup, losersOf, photoNames, winnersOf } from "@/lib/compare-groups";

/** What finishing does to the winners, or that there are none. */
function winnerNote(group: CompareGroup): string {
  const winners = winnersOf(group);
  if (winners.length === 0) return "No winner is picked, so every photo just leaves the group.";
  return `${photoNames(winners)} won. Give a winner a title on the Photo page to post it, if it doesn't have one.`;
}

/**
 * Finish comparing: after asking, takes every photo out of the group. With winners picked, the
 * others can be left as they are (the untitled ones set aside as Undecided), or moved to Unselected
 * Photos with a reason, keeping all, some or none of their images in R2.
 */
export function FinishComparing({ group }: { group: CompareGroup }) {
  const [open, setOpen] = useState(false);
  // Once deleting from R2 starts, the dialog stays open until the losers are marked, so none is
  // left without its images and without being in Unselected Photos.
  const [locked, setLocked] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FlagIcon />
        Finish comparing
      </Button>
      <Dialog open={open} onOpenChange={(next) => locked || setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finish “{group.name}”?</DialogTitle>
            <DialogDescription>
              Takes all {group.photos.length} photos out of the group. {winnerNote(group)}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <FinishForm
              group={group}
              onCancel={() => setOpen(false)}
              onLock={() => setLocked(true)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The form's first choice: Unselected Photos when there are winners and losers, else leave them. */
function initialForm(group: CompareGroup): LosersForm {
  const picked = winnersOf(group).length > 0;
  const unselect = picked && losersOf(group).length > 0;
  // Without winners nothing lost, so nothing is set aside.
  return { kind: unselect ? "unselect" : "leave", setAside: picked, reason: "", keep: "small" };
}

interface FinishFormProps {
  group: CompareGroup;
  onCancel: () => void;
  /** Called when deleting from R2 starts, after which the dialog can't be closed without finishing. */
  onLock: () => void;
}

function FinishForm({ group, onCancel, onLock }: FinishFormProps) {
  const [form, setForm] = useState(() => initialForm(group));
  const { busy, failures, start, retry, finishAnyway } = useFinishGroup(group, form, onLock);
  const losers = losersOf(group);
  if (failures)
    return (
      <DeleteFailures
        failures={failures}
        busy={busy}
        onFinish={finishAnyway}
        onRetry={() => void retry()}
      />
    );
  return (
    <>
      <LosersOptions
        form={form}
        onChange={setForm}
        losers={losers}
        winners={winnersOf(group).length}
        untitled={untitledLosers(group).length}
        disabled={busy}
      />
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onCancel}>
          Keep comparing
        </Button>
        <Button disabled={busy} onClick={() => void start()}>
          {busy && <Spinner />}
          {busy ? "Deleting from R2…" : "Finish"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * The photos whose images couldn't all be deleted from R2, with why, Try again, and Finish anyway,
 * which moves them to Unselected Photos as still in R2, so they can be deleted from there later.
 * There's no going back to comparing, since the other losers' images are already gone.
 */
function DeleteFailures({
  failures,
  busy,
  onFinish,
  onRetry,
}: {
  failures: DiscardFailure[];
  busy: boolean;
  onFinish: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-destructive">
          Not everything could be deleted from R2. Try again, or finish anyway, which marks these as
          still in R2 so Unselected Photos can delete them later:
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {failures.map((failure) => (
            <li key={failure.path}>
              <span className="font-medium">{failure.name}</span>: {failure.message}
            </li>
          ))}
        </ul>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onRetry}>
          {busy && <Spinner />}
          Try again
        </Button>
        <Button disabled={busy} onClick={onFinish}>
          Finish anyway
        </Button>
      </DialogFooter>
    </>
  );
}
