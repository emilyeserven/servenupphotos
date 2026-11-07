import { type PruneTags, type PruneTagsPreview, applyPruneTagsMutation } from "@/api/prune-tags";
import {
  NoteSection,
  PruneSections,
  ReviewSave,
  notesToSave,
  pruneToSave,
  useChangeToggle,
  useTagSave,
} from "@/components/prune-tags/change-list";
import { CommitSuccess, count } from "@/components/update-data-shared";

/** How many changes save makes, notes too. */
function changeCount(save: PruneTags & { notes: unknown[] }): number {
  return save.merge.length + save.remove.length + save.reparent.length + save.notes.length;
}

/**
 * The review of the LLM's answer: the tags to merge, remove and put under others, each of which
 * can be unticked, the changes that can't be made and why, then a button that saves the rest.
 */
export function PruneTagReview({ preview }: { preview: PruneTagsPreview }) {
  const apply = useTagSave(applyPruneTagsMutation);
  const toggle = useChangeToggle(apply.isPending || apply.isSuccess);
  const save = {
    ...pruneToSave(preview, toggle.unticked),
    notes: notesToSave(preview.notes, toggle.unticked),
  };
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <PruneSections preview={preview} toggle={toggle} />
      <NoteSection notes={preview.notes} toggle={toggle} />
      <ReviewSave
        skipped={preview.skipped}
        save={save}
        changes={changeCount(save)}
        disabled={toggle.disabled}
        apply={apply}
      />
      {apply.data && (
        <CommitSuccess result={apply.data}>
          Deleted {count(apply.data.deleted, "tag")}, gave {count(apply.data.reparented, "tag")} a
          new parent and changed the tags or notes of {count(apply.data.photos, "photo")}
        </CommitSuccess>
      )}
    </div>
  );
}
