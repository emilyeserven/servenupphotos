import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type BulkTagPick,
  pickBulkTagPhotosMutation,
  previewBulkTagsMutation,
} from "@/api/bulk-tags";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { BulkTagReview } from "@/components/bulk-tagging/bulk-tag-review";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { defaultBulkTagCount } from "@/components/bulk-tagging/pick-count";
import { CopyPromptButton, PickBar, usePhotoPick } from "@/components/bulk-tagging/pick-controls";
import { ContactSheetsButton, usePickedContactSheets } from "@/components/contact-sheets-button";
import { UntaggedCount } from "@/components/bulk-tagging/untagged-count";
import { PasteAnswer } from "@/components/paste-answer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionCheckbox } from "@/components/update-data-shared";
import { bulkTagPrompt } from "@/lib/bulk-tag-prompt";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { useCombinedData } from "@/stores/combined-data";
import { ErrorNote } from "@/components/error-note";

/**
 * Bulk Tagging: picks up to the chosen number of photos without tags (5 at first, up to 50, or
 * every one with No limit), related or any, copies one tag prompt for all of them, and reads the LLM's JSON answer back into a review of the tags each photo gets and the new tags to make.
 */
export function BulkTaggingCard() {
  const [related, setRelated] = useState(true);
  const [noLimit, setNoLimit] = useState(false);
  const { pick, bar } = usePhotoPick(pickBulkTagPhotosMutation, defaultBulkTagCount, {
    any: !related,
    all: noLimit,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk tagging</CardTitle>
        <CardDescription>
          Picks up to the chosen number of photos (up to 50, or every one) without tags: ones that
          go together, or any of them. Photos that already have tags are left out. Copy one prompt
          for all of them into a chat with an LLM, paste its JSON answer back, and review the tags
          before they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <UntaggedCount />
        <OptionCheckbox
          label="Pick photos that go together"
          hint="On, one photo and then the ones that share its places, city or country, genres or date. Off, the first photos without tags by file name, whatever they share."
          checked={related}
          disabled={pick.isPending}
          onChange={setRelated}
        />
        <OptionCheckbox
          label="No limit"
          hint="Picks every photo without tags instead of a number of them (with Pick photos that go together, every one that shares something with the first). Make contact sheets before copying the prompt, so the LLM looks through a few sheets instead of every photo's link."
          checked={noLimit}
          disabled={pick.isPending}
          onChange={setNoLimit}
        />
        <PickBar {...bar} noLimit={noLimit} />
        <ErrorNote error={pick.error} />
        {pick.data && <PickedTagging key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedTagging({ pick }: { pick: BulkTagPick }) {
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewBulkTagsMutation);
  const pasted = usePastedAnswer((answer) => preview.mutateAsync({ paths, answer }));
  return (
    <div className="flex flex-col gap-4">
      <PickedPhotos photos={pick.photos} />
      <CopyTagPromptButton pick={pick} />
      <PasteAnswer pasted={pasted} label="Review the tags" />
      {pasted.answer && <BulkTagReview key={pasted.reviews} preview={pasted.answer} pick={pick} />}
    </div>
  );
}

/** Copies the prompt for every picked photo, with the tags to reuse and the names to leave out. */
function CopyTagPromptButton({ pick }: { pick: BulkTagPick }) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const combined = useCombinedData();
  const data = organize.data;
  const contact = usePickedContactSheets(pick.photos);
  return (
    <>
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={`Copy the tag prompt for ${pick.photos.length} photos`}
        disabled={!data || contact.pending}
        prompt={() =>
          data
            ? bulkTagPrompt(
                pick.photos,
                { ...data, metaGroups: metaGroups(combined.data) },
                readEntries(places.data?.places),
                contact.sheets,
              )
            : ""
        }
      />
    </>
  );
}
