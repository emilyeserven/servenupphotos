import {
  type TagLibrary,
  type TagLibraryPreview,
  applyTagLibraryMutation,
} from "@/api/tag-library";
import {
  PruneSections,
  ReviewSave,
  notesToSave,
  pruneToSave,
  tickedIn,
  useChangeToggle,
  useTagSave,
} from "@/components/prune-tags/change-list";
import {
  FewPhotos,
  NewTagSections,
  PhotoSections,
} from "@/components/tag-library/library-sections";
import { CommitSuccess, count } from "@/components/update-data-shared";

/** The ticked changes of preview, as the save takes them. */
function libraryToSave(preview: TagLibraryPreview, unticked: ReadonlySet<string>): TagLibrary {
  const ticked = (kind: string) => tickedIn(unticked, kind);
  return {
    ...pruneToSave(preview, unticked),
    newTags: preview.newTags
      .filter(ticked("newTags"))
      .map(({ tag, description, parent }) => ({ id: tag, description, parent })),
    rename: preview.rename.filter(ticked("rename")).map(({ tag, to }) => ({ tag, to })),
    describe: preview.describe
      .filter(ticked("describe"))
      .map(({ tag, description }) => ({ tag, description })),
    photos: preview.edits
      .filter(ticked("photos"))
      .map(({ path, add, remove }) => ({ path, add, remove })),
    notes: notesToSave(preview.notes, unticked),
  };
}

/** How many changes save makes. */
function changeCount(save: TagLibrary): number {
  return Object.values(save).reduce((sum: number, list: unknown[]) => sum + list.length, 0);
}

/**
 * The review of the LLM's answer for the whole tag library: every change, each of which can be
 * unticked, the tags left with too few photos, the changes that can't be made and why, then a
 * button that saves the rest.
 */
export function TagLibraryReview({ preview }: { preview: TagLibraryPreview }) {
  const apply = useTagSave(applyTagLibraryMutation);
  const toggle = useChangeToggle(apply.isPending || apply.isSuccess);
  const save = libraryToSave(preview, toggle.unticked);
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <NewTagSections preview={preview} toggle={toggle} />
      <PruneSections preview={preview} toggle={toggle} />
      <PhotoSections preview={preview} toggle={toggle} />
      <FewPhotos preview={preview} />
      <ReviewSave
        skipped={preview.skipped}
        save={save}
        changes={changeCount(save)}
        disabled={toggle.disabled}
        apply={apply}
      />
      {apply.data && (
        <CommitSuccess result={apply.data}>
          Made {count(apply.data.made, "tag")}, deleted {apply.data.deleted}, changed{" "}
          {apply.data.edited} and changed the tags or notes of {count(apply.data.photos, "photo")}
        </CommitSuccess>
      )}
    </div>
  );
}
