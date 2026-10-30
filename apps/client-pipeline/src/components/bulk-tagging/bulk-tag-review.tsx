import { useState } from "react";
import {
  type BulkTagNew,
  type BulkTagPick,
  type BulkTagsPreview,
  applyBulkTagsMutation,
} from "@/api/bulk-tags";
import {
  PlannedPhoto,
  SaveReviewed,
  UnknownPhotos,
  pickedTitle,
  useReviewedSave,
} from "@/components/bulk-tagging/review-parts";
import { count } from "@/components/update-data-shared";
import { type BulkTagChoices, NO_CHOICES, bulkTagsToSave, toggled } from "@/lib/bulk-tags";

interface BulkTagReviewProps {
  preview: BulkTagsPreview;
  pick: BulkTagPick;
}

/**
 * The review of the LLM's answer: the new tags to make, each with its definition and parent, and
 * the tags each photo gets, any of which can be unticked, then a button that saves the rest.
 */
export function BulkTagReview({ preview, pick }: BulkTagReviewProps) {
  const [choices, setChoices] = useState<BulkTagChoices>(NO_CHOICES);
  const apply = useReviewedSave(applyBulkTagsMutation);
  const busy = apply.isPending || apply.isSuccess;
  const fresh = new Set(preview.newTags.map((tag) => tag.id));
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownPhotos names={preview.unknown} noun="tags" />
      {/* Once saved, the new tags are made, so only what was saved is left to say. */}
      {!apply.isSuccess && (
        <NewTagList preview={preview} choices={choices} onChange={setChoices} disabled={busy} />
      )}
      <ul className="flex flex-col gap-3">
        {preview.photos.map((plan) => (
          <PlannedPhoto
            key={plan.path}
            plan={plan}
            title={pickedTitle(pick.photos, plan.path)}
            noun="tags"
            label={(id) => id}
            fresh={fresh}
            dropped={choices.dropped}
            removed={choices.removed}
            disabled={busy}
            onToggle={(key) => setChoices({ ...choices, removed: toggled(choices.removed, key) })}
          />
        ))}
      </ul>
      <SaveReviewed
        apply={apply}
        save={bulkTagsToSave(preview, choices)}
        noun="tags"
        busy={busy}
        done={(data) =>
          `Made ${count(data.newTags, "new tag")} and tagged ${count(data.photos, "photo")}`
        }
      />
    </div>
  );
}

interface ChoicesProps {
  choices: BulkTagChoices;
  onChange: (choices: BulkTagChoices) => void;
  disabled: boolean;
}

/** The new tags the answer names, each of which can be left out or kept off its parent. */
function NewTagList({
  preview,
  choices,
  onChange,
  disabled,
}: ChoicesProps & { preview: BulkTagsPreview }) {
  const tags = preview.newTags.filter((tag) => !tag.parentOnly);
  if (tags.length === 0) return <p className="text-muted-foreground">Every tag is one already.</p>;
  const parentOnly = new Set(preview.newTags.filter((tag) => tag.parentOnly).map((tag) => tag.id));
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>
        New tags, made with the definitions as their descriptions. Untick any you don&apos;t want:
      </p>
      <ul className="flex flex-col gap-1.5">
        {tags.map((tag) => (
          <NewTagRow
            key={tag.id}
            tag={tag}
            parentIsNew={
              parentOnly.has(tag.parent) || preview.newTags.some((t) => t.id === tag.parent)
            }
            choices={choices}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </ul>
    </div>
  );
}

/** One new tag's checkbox and definition, and a checkbox for the parent the answer suggests. */
function NewTagRow({
  tag,
  parentIsNew,
  choices,
  onChange,
  disabled,
}: ChoicesProps & { tag: BulkTagNew; parentIsNew: boolean }) {
  const made = !choices.dropped.has(tag.id);
  return (
    <li className="flex flex-col gap-0.5">
      <label className="flex items-start gap-1.5">
        <input
          type="checkbox"
          className="mt-1"
          checked={made}
          disabled={disabled}
          onChange={() => onChange({ ...choices, dropped: toggled(choices.dropped, tag.id) })}
        />
        <span>
          {tag.id}
          {tag.description && <span className="text-muted-foreground">: {tag.description}</span>}
        </span>
      </label>
      <ParentToggle
        tag={tag}
        parentIsNew={parentIsNew}
        choices={choices}
        onChange={onChange}
        disabled={disabled || !made}
      />
    </li>
  );
}

/** The checkbox that puts a new tag under the parent the answer suggests, when it suggests one. */
function ParentToggle({
  tag,
  parentIsNew,
  choices,
  onChange,
  disabled,
}: ChoicesProps & { tag: BulkTagNew; parentIsNew: boolean }) {
  if (!tag.parent) return null;
  return (
    <label className="text-muted-foreground ml-6 flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={!choices.noParent.has(tag.id)}
        disabled={disabled}
        onChange={() => onChange({ ...choices, noParent: toggled(choices.noParent, tag.id) })}
      />
      <span>
        Under <code className="text-foreground">{tag.parent}</code>
        {parentIsNew && ", which is new too"}
      </span>
    </label>
  );
}
