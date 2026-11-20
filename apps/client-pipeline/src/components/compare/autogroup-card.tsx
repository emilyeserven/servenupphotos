import { useId, useMemo, useState } from "react";
import { AutogroupReview } from "@/components/compare/autogroup-review";
import { ReadProblems } from "@/components/compare/compare-group-list";
import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { PasteAnswer } from "@/components/paste-answer";
import { ContactSheetsButton, useContactSheets } from "@/components/contact-sheets-button";
import { PhotoScopeToggle } from "@/components/photo-scope-toggle";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompareGroups } from "@/hooks/use-compare-groups";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import {
  type AutogroupAsk,
  type AutogroupOptions,
  type AutogroupPhoto,
  autogroupAsk,
  autogroupPrompt,
  autogroupSheetPhotos,
  linkedPhotos,
} from "@/lib/compare-autogroup";
import { readAutogroupAnswer } from "@/lib/compare-autogroup-answer";
import type { ComparePhoto } from "@/lib/compare-groups";
import { ReadingNote } from "@/components/query-result";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/**
 * Autogroup: chooses every photo or only the drafts, copies one prompt linking all their Small
 * images for an LLM, and reads its JSON answer back into compare groups to review and make.
 */
export function AutogroupCard() {
  const compare = useCompareGroups();
  const [options, setOptions] = useState<AutogroupOptions>({ scope: "all", withGroups: true });
  const ask = useMemo(() => autogroupAsk(compare.photos, options), [compare.photos, options]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Autogroup</CardTitle>
        <CardDescription>
          Copy one prompt linking every chosen photo&apos;s Small version into a chat with an LLM,
          which finds the photos that are too similar to all be posted, not only near duplicates, in
          groups of any size, and can add photos to the groups there are, combine them or remove
          them. Paste its JSON answer back, review the changes, and make the ones you keep, waiting
          for Commit like any other compare group.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ReadProblems problems={compare.problems} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <PhotoScopeToggle
            label="Which photos to group"
            value={options.scope}
            onChange={(scope) => setOptions({ ...options, scope })}
          />
          <WithGroupsCheck
            checked={options.withGroups}
            onChange={(withGroups) => setOptions({ ...options, withGroups })}
          />
        </div>
        {compare.pending ? (
          <ReadingNote label="Reading the photos…" />
        ) : (
          <AutogroupPrompt
            key={`${options.scope}-${options.withGroups}`}
            ask={ask}
            all={compare.photos}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Sends the compare groups there are, so the LLM can change them. */
function WithGroupsCheck({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>Let it change the groups there are</label>
    </div>
  );
}

interface AutogroupPromptProps {
  /** The photos in no group and the compare groups the prompt asks about. */
  ask: AutogroupAsk;
  /** Every photo that can be compared, to count the ones in a suggested group already. */
  all: ComparePhoto[];
}

/** The photos asked about, their prompt, the box to paste the answer into, and the review of it. */
function AutogroupPrompt({ ask, all }: AutogroupPromptProps) {
  // Each review starts fresh, so changes left out of the last one aren't left out of the next.
  const pasted = usePastedAnswer((text) => readAutogroupAnswer(text, ask, all));
  return (
    <div className="flex flex-col gap-4">
      <CopyAutogroupPrompt ask={ask} />
      <PasteAnswer pasted={pasted} label="Review the changes" />
      {pasted.answer && <AutogroupReview key={pasted.reviews} answer={pasted.answer} />}
      <PhotoTiles photos={ask.loose} />
    </div>
  );
}

/** Makes the contact sheets of the prompt's photos, and copies the prompt, linking them when they're made. */
function CopyAutogroupPrompt({ ask }: { ask: AutogroupAsk }) {
  const sheetPhotos = useMemo(() => autogroupSheetPhotos(linkedPhotos(ask)), [ask]);
  const contact = useContactSheets(sheetPhotos);
  const empty = ask.loose.length === 0 && ask.groups.length === 0;
  return (
    <>
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={promptLabel(ask)}
        disabled={empty || contact.pending}
        prompt={() => autogroupPrompt(ask, contact.sheets)}
      />
    </>
  );
}

/** The copy button's words, with how many photos and groups the prompt sends. */
function promptLabel(ask: AutogroupAsk): string {
  const groups = ask.groups.length > 0 ? ` and ${count(ask.groups.length, "group")}` : "";
  return `Copy the Autogroup prompt for ${count(ask.loose.length, "photo")}${groups}`;
}

/** The photos as small square tiles, each named on hover, or that there are none. */
function PhotoTiles({ photos }: { photos: AutogroupPhoto[] }) {
  if (photos.length === 0) {
    return <EmptyNote>No photos outside a group with these choices.</EmptyNote>;
  }
  return (
    <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-12">
      {photos.map((entry) => (
        <li key={entry.key} title={entry.takenAt ? `${entry.key}, ${entry.takenAt}` : entry.key}>
          <PickedThumbnail data={entry.photo.data} alt={entry.key} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
