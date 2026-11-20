import { useMemo } from "react";
import { CopyPromptButton, PasteAnswer } from "@/components/bulk-tagging/pick-controls";
import { ContactSheetsButton, useContactSheets } from "@/components/contact-sheets-button";
import { type FlagItem, FlagList } from "@/components/quality-check/flag-list";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { type AutogroupPhoto, autogroupSheetPhotos } from "@/lib/compare-autogroup";
import {
  type PixelationAnswer,
  pixelationPrompt,
  readPixelationAnswer,
} from "@/lib/pixelation-prompt";
import { count } from "@portfolio/lib/words";
import { SectionTitle } from "@/components/section-title";

/**
 * The flagged photos as rows of the list to flag, each with the photo as it is now in `photos`, so
 * a flag made since the review shows.
 */
function flagItems(answer: PixelationAnswer, photos: AutogroupPhoto[]): FlagItem[] {
  const current = new Map(photos.map((entry) => [entry.key, entry]));
  return answer.flagged.map(({ entry, pixelate, flag }) => ({
    entry: current.get(entry.key) ?? entry,
    flag,
    detail: pixelate.length > 0 ? `Pixelate: ${pixelate.join(", ")}` : "Needs pixelation",
  }));
}

interface PixelationCheckProps {
  /** The chosen photos, which the prompt asks about. */
  photos: AutogroupPhoto[];
  /** Every photo that can be checked, so an answer can name photos the prompt didn't ask about. */
  every: AutogroupPhoto[];
}

/** The chosen photos, then every other photo, each once. */
function withEvery(photos: AutogroupPhoto[], every: AutogroupPhoto[]): AutogroupPhoto[] {
  const keys = new Set(photos.map((entry) => entry.key));
  return [...photos, ...every.filter((entry) => !keys.has(entry.key))];
}

/**
 * The pixelation check: copies one prompt linking every chosen photo (and their contact sheets)
 * asking an LLM which show readable license plates or recognizable faces, then reads its JSON
 * answer into a list of photos to flag for re-edit (any photo it names, not only the chosen ones), each linked to the Photo page's face
 * pixelation.
 */
export function PixelationCheck({ photos, every }: PixelationCheckProps) {
  const answerable = useMemo(() => withEvery(photos, every), [photos, every]);
  const { typed, setTyped, answer, error, reviews, review } = usePastedAnswer((text) =>
    readPixelationAnswer(text, answerable),
  );
  const sheetPhotos = useMemo(() => autogroupSheetPhotos(photos), [photos]);
  const contact = useContactSheets(sheetPhotos);
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>License plates and faces</SectionTitle>
      <p className="text-muted-foreground max-w-prose text-sm">
        Copy one prompt into a chat with an LLM, which looks for readable license plates and faces
        someone could recognize. Paste its JSON answer back to list the photos it flagged, with what
        to hide and where.
      </p>
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={`Copy the pixelation prompt for ${count(photos.length, "photo")}`}
        disabled={photos.length === 0 || contact.pending}
        prompt={() => pixelationPrompt(photos, contact.sheets)}
      />
      <PasteAnswer
        value={typed}
        onChange={setTyped}
        pending={false}
        label="Review the flagged photos"
        onReview={review}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      {answer && <AnswerView key={reviews} answer={answer} photos={answerable} />}
    </section>
  );
}

/** The photos the answer flagged, and the names in it that aren't photos here. */
function AnswerView({ answer, photos }: { answer: PixelationAnswer; photos: AutogroupPhoto[] }) {
  return (
    <>
      <p className="text-sm">
        {answer.flagged.length === 0
          ? "The answer flagged no photos."
          : `The answer flagged ${count(answer.flagged.length, "photo")}.`}
      </p>
      {answer.flagged.length > 0 && (
        <FlagList items={flagItems(answer, photos)} linkLabel="Pixelate faces" />
      )}
      {answer.unknown.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Skipped, since they aren&apos;t photos: {answer.unknown.join(", ")}.
        </p>
      )}
    </>
  );
}
