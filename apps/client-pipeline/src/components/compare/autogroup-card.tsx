import { useId, useMemo, useState } from "react";
import { AutogroupReview } from "@/components/compare/autogroup-review";
import { ReadProblems } from "@/components/compare/compare-group-list";
import { CopyPromptButton, PasteAnswer } from "@/components/bulk-tagging/pick-controls";
import { ContactSheetsButton, useContactSheets } from "@/components/contact-sheets-button";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { PhotoScopeToggle } from "@/components/photo-scope-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { count } from "@/components/update-data-shared";
import { useCompareGroups } from "@/hooks/use-compare-groups";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import {
  type AutogroupOptions,
  type AutogroupPhoto,
  autogroupPhotos,
  autogroupPrompt,
  autogroupSheetPhotos,
  readAutogroupAnswer,
} from "@/lib/compare-autogroup";
import type { ComparePhoto } from "@/lib/compare-groups";

/**
 * Autogroup: chooses every photo or only the drafts, copies one prompt linking all their Small
 * images for an LLM, and reads its JSON answer back into compare groups to review and make.
 */
export function AutogroupCard() {
  const compare = useCompareGroups();
  const [options, setOptions] = useState<AutogroupOptions>({ scope: "all", skipGrouped: true });
  const photos = useMemo(() => autogroupPhotos(compare.photos, options), [compare.photos, options]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Autogroup</CardTitle>
        <CardDescription>
          Copy one prompt linking every chosen photo&apos;s Small version into a chat with an LLM,
          which finds the photos that are too similar to all be posted, not only near duplicates, in
          groups of any size. Paste its JSON answer back, review the groups, and add them to
          Compare, waiting for Commit like any other compare group.
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
          <SkipGroupedCheck
            checked={options.skipGrouped}
            onChange={(skipGrouped) => setOptions({ ...options, skipGrouped })}
          />
        </div>
        {compare.pending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <AutogroupPrompt
            key={`${options.scope}-${options.skipGrouped}`}
            asked={photos}
            all={compare.photos}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Leaves out photos already in a compare group. */
function SkipGroupedCheck({
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
      <label htmlFor={id}>Leave out photos already in a group</label>
    </div>
  );
}

interface AutogroupPromptProps {
  /** The photos the prompt asks about, oldest first. */
  asked: AutogroupPhoto[];
  /** Every photo that can be compared, to count the ones in a suggested group already. */
  all: ComparePhoto[];
}

/** The photos asked about, their prompt, the box to paste the answer into, and the review of it. */
function AutogroupPrompt({ asked, all }: AutogroupPromptProps) {
  // Each review starts fresh, so groups left out of the last one aren't left out of the next.
  const { typed, setTyped, answer, error, reviews, review } = usePastedAnswer((text) =>
    readAutogroupAnswer(text, asked, all),
  );
  const sheetPhotos = useMemo(() => autogroupSheetPhotos(asked), [asked]);
  const contact = useContactSheets(sheetPhotos);
  return (
    <div className="flex flex-col gap-4">
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={`Copy the Autogroup prompt for ${count(asked.length, "photo")}`}
        disabled={asked.length === 0 || contact.pending}
        prompt={() => autogroupPrompt(asked, contact.sheets)}
      />
      <PasteAnswer
        value={typed}
        onChange={setTyped}
        pending={false}
        label="Review the groups"
        onReview={review}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      {answer && <AutogroupReview key={reviews} answer={answer} />}
      <PhotoTiles photos={asked} />
    </div>
  );
}

/** The photos as small square tiles, each named on hover, or that there are none. */
function PhotoTiles({ photos }: { photos: AutogroupPhoto[] }) {
  if (photos.length === 0) {
    return <p className="text-muted-foreground text-sm">No photos to group with these choices.</p>;
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
