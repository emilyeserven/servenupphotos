import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { LosersForm } from "@/components/compare/losers-options";
import { type LosersChoice, useCompareEdits } from "@/hooks/use-compare-groups";
import { type DiscardFailure, useDiscardImages } from "@/hooks/use-discard-images";
import { type CompareGroup, type ComparePhoto, losersOf } from "@/lib/compare-groups";
import type { UnselectedImages } from "@/lib/unselected";

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

/** The losers whose images couldn't all be deleted. */
function failedPhotos(losers: ComparePhoto[], failures: DiscardFailure[]): ComparePhoto[] {
  const failed = new Set(failures.map((failure) => failure.path));
  return losers.filter((photo) => failed.has(photo.file.path));
}

/** What's kept in R2 as the form says. */
function keepOf(form: LosersForm): UnselectedImages {
  return deletes(form) ? form.keep : "kept";
}

/**
 * Finish comparing for the group as the form says: deletes the losers' images from R2 first when
 * it asks to, then takes every photo out of the group and goes back to the list. `onLock` is called
 * when deleting starts, since from then on the losers have to be marked. When some can't be
 * deleted, `failures` lists them, `retry` deletes them again and `finishAnyway` marks them as
 * still in R2.
 */
export function useFinishGroup(group: CompareGroup, form: LosersForm, onLock: () => void) {
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<DiscardFailure[] | null>(null);
  const { finish } = useCompareEdits();
  const discard = useDiscardImages();
  const navigate = useNavigate();
  const losers = losersOf(group);
  const keep = keepOf(form);
  const apply = (failed: DiscardFailure[]) => {
    finish(group, losersChoice(form, imagesAfter(losers, keep, failed)));
    void navigate({ to: "/compare" });
  };
  const run = async (photos: ComparePhoto[]) => {
    onLock();
    setBusy(true);
    const failed = await discard(photos, keep as "small" | "deleted");
    setBusy(false);
    if (failed.length === 0) return apply([]);
    setFailures(failed);
  };
  return {
    busy,
    failures,
    start: () => (deletes(form) ? run(losers) : apply([])),
    retry: () => run(failedPhotos(losers, failures ?? [])),
    finishAnyway: () => apply(failures ?? []),
  };
}
