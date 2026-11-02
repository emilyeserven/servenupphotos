import { useNavigate } from "@tanstack/react-router";
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
import { type LosersChoice, untitledLosers, useCompareEdits } from "@/hooks/use-compare-groups";
import { type DiscardFailure, useDiscardImages } from "@/hooks/use-discard-images";
import {
  type CompareGroup,
  type ComparePhoto,
  losersOf,
  photoNames,
  winnersOf,
} from "@/lib/compare-groups";
import type { UnselectedImages } from "@/lib/unselected";

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
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FlagIcon />
        Finish comparing
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finish “{group.name}”?</DialogTitle>
            <DialogDescription>
              Takes all {group.photos.length} photos out of the group. {winnerNote(group)}
            </DialogDescription>
          </DialogHeader>
          {open && <FinishForm group={group} onCancel={() => setOpen(false)} />}
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

/** What each loser has left in R2 after deleting, when the delete left some of it there. */
function imagesAfter(
  losers: ComparePhoto[],
  keep: UnselectedImages,
  failures: DiscardFailure[],
): Record<string, UnselectedImages> {
  const failed = new Set(failures.map((failure) => failure.path));
  return Object.fromEntries(
    losers.map((photo) => [photo.file.path, failed.has(photo.file.path) ? "kept" : keep]),
  );
}

/** The form as Finish comparing applies it. */
function losersChoice(form: LosersForm, images: Record<string, UnselectedImages>): LosersChoice {
  if (form.kind === "leave") return { kind: "leave", setAside: form.setAside };
  return { kind: "unselect", reason: form.reason.trim(), images };
}

/** Whether finishing deletes images from R2 first. */
function deletes(form: LosersForm): form is LosersForm & { keep: "small" | "deleted" } {
  return form.kind === "unselect" && form.keep !== "kept";
}

function FinishForm({ group, onCancel }: { group: CompareGroup; onCancel: () => void }) {
  const [form, setForm] = useState(() => initialForm(group));
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<DiscardFailure[] | null>(null);
  const { finish } = useCompareEdits();
  const discard = useDiscardImages();
  const navigate = useNavigate();
  const losers = losersOf(group);
  const apply = (images: Record<string, UnselectedImages>) => {
    finish(group, losersChoice(form, images));
    void navigate({ to: "/compare" });
  };
  const start = async () => {
    if (!deletes(form)) return apply(imagesAfter(losers, "kept", []));
    setBusy(true);
    const failed = await discard(losers, form.keep);
    setBusy(false);
    if (failed.length === 0) return apply(imagesAfter(losers, form.keep, []));
    setFailures(failed);
  };
  if (failures)
    return (
      <DeleteFailures
        failures={failures}
        onFinish={() => apply(imagesAfter(losers, form.keep, failures))}
        onCancel={onCancel}
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
 * The photos whose images couldn't all be deleted from R2, with why, and Finish anyway, which
 * moves them to Unselected Photos as still in R2, so they can be deleted from there later.
 */
function DeleteFailures({
  failures,
  onFinish,
  onCancel,
}: {
  failures: DiscardFailure[];
  onFinish: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-destructive">
          Not everything could be deleted from R2. Finishing anyway marks these as still in R2, and
          Unselected Photos can delete them later:
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
        <Button variant="outline" onClick={onCancel}>
          Keep comparing
        </Button>
        <Button onClick={onFinish}>Finish anyway</Button>
      </DialogFooter>
    </>
  );
}
