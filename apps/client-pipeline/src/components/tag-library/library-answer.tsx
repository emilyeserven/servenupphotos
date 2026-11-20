import { useMutation, useQuery } from "@tanstack/react-query";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { previewTagLibraryMutation } from "@/api/tag-library";
import { PasteAnswer } from "@/components/paste-answer";
import { TagLibraryReview } from "@/components/tag-library/tag-library-review";
import { filteredNames } from "@/lib/tag-prompt";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The names the site already filters by, for the Tag library's prompts, once the albums and tags
 * are read (`ready`), and a function that lists them.
 */
export function useFilteredNames() {
  const organize = useQuery(organizeQuery);
  const combined = useCombinedData();
  const filtered = () =>
    organize.data ? filteredNames({ ...organize.data, metaGroups: metaGroups(combined.data) }) : [];
  return { ready: organize.data !== undefined, filtered };
}

/** The box to paste the LLM's answer in the Tag library's JSON into, and its review. */
export function LibraryAnswer() {
  const preview = useMutation(previewTagLibraryMutation);
  const pasted = usePastedAnswer((answer) => preview.mutateAsync({ answer }));
  return (
    <>
      <PasteAnswer pasted={pasted} label="Review the changes" />
      {pasted.answer && <TagLibraryReview key={pasted.reviews} preview={pasted.answer} />}
    </>
  );
}
