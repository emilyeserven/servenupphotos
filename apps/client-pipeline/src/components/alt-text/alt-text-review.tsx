import { useState } from "react";
import {
  type AltTextPick,
  type AltTextPreview,
  type AltTextSuggestion,
  applyAltTextMutation,
} from "@/api/alt-text";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import {
  SaveReviewed,
  UnknownPhotos,
  pickedTitle,
  useReviewedSave,
} from "@/components/bulk-tagging/review-parts";
import { AltTextLength } from "@/components/photo-alt-text-field";
import { Textarea } from "@/components/ui/textarea";
import { count } from "@/components/update-data-shared";
import { ALT_TEXT_MAX, type AltTextDraft, altTextsToSave, startingDrafts } from "@/lib/alt-text";

interface AltTextReviewProps {
  preview: AltTextPreview;
  pick: AltTextPick;
}

/**
 * The review of the LLM's answer: each photo next to its alt text, which can be edited or unticked,
 * then a button that saves the ticked ones.
 */
export function AltTextReview({ preview, pick }: AltTextReviewProps) {
  const [drafts, setDrafts] = useState(() => startingDrafts(preview.photos));
  const apply = useReviewedSave(applyAltTextMutation);
  const busy = apply.isPending || apply.isSuccess;
  const change = (path: string, draft: AltTextDraft) =>
    setDrafts((all) => ({ ...all, [path]: draft }));
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownPhotos names={preview.unknown} noun="alt text" />
      <ul className="flex flex-col gap-3">
        {preview.photos.map((suggestion) => (
          <AltTextRow
            key={suggestion.path}
            suggestion={suggestion}
            photo={pick.photos.find((photo) => photo.path === suggestion.path)?.data}
            title={pickedTitle(pick.photos, suggestion.path)}
            draft={drafts[suggestion.path] ?? { text: "", ticked: false }}
            disabled={busy}
            onChange={(draft) => change(suggestion.path, draft)}
          />
        ))}
      </ul>
      <SaveReviewed
        apply={apply}
        save={altTextsToSave(drafts)}
        noun="alt text"
        busy={busy}
        done={(data) => `Saved alt text for ${count(data.photos, "photo")}`}
      />
    </div>
  );
}

interface AltTextRowProps {
  suggestion: AltTextSuggestion;
  /** The photo's JSON, for its thumbnail. */
  photo: Record<string, unknown> | undefined;
  title: string;
  draft: AltTextDraft;
  disabled: boolean;
  onChange: (draft: AltTextDraft) => void;
}

/** One photo's thumbnail and alt text, which can be edited, and its checkbox. */
function AltTextRow({ suggestion, photo = {}, ...row }: AltTextRowProps) {
  return (
    <li className="flex gap-3 rounded-md border p-3">
      <PickedThumbnail data={photo} alt={row.title} className="size-20 shrink-0 sm:size-28" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <AltTextRowHeading name={suggestion.name} {...row} />
        <Textarea
          aria-label={`Alt text for ${suggestion.name}`}
          className="min-h-16"
          maxLength={ALT_TEXT_MAX}
          placeholder="The answer has no alt text for this photo. Write some to save it."
          value={row.draft.text}
          disabled={row.disabled}
          onChange={(event) => row.onChange(edited(event.target.value))}
        />
        <Replaces current={suggestion.current} />
      </div>
    </li>
  );
}

/** A draft of text, ticked once it has some. */
function edited(text: string): AltTextDraft {
  return { text, ticked: text.trim() !== "" };
}

type AltTextRowHeadingProps = Omit<AltTextRowProps, "suggestion" | "photo"> & { name: string };

/** The photo's checkbox, name and title, and how long its alt text is. */
function AltTextRowHeading({ name, title, draft, disabled, onChange }: AltTextRowHeadingProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <label className="flex min-w-0 items-center gap-1.5">
        <input
          type="checkbox"
          checked={draft.ticked}
          disabled={disabled || draft.text.trim() === ""}
          onChange={() => onChange({ ...draft, ticked: !draft.ticked })}
        />
        <code className="truncate">{name}</code>
        {title && <span className="text-muted-foreground truncate">· {title}</span>}
      </label>
      <AltTextLength value={draft.text} />
    </div>
  );
}

/** The alt text the photo has already, which saving replaces; nothing when it has none. */
function Replaces({ current }: { current: string }) {
  return current && <p className="text-muted-foreground">Replaces “{current}”</p>;
}
