import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { previewTagLibraryMutation } from "@/api/tag-library";
import { ErrorText, PasteAnswer } from "@/components/bulk-tagging/pick-controls";
import { TagLibraryReview } from "@/components/tag-library/tag-library-review";
import { filteredNames } from "@/lib/tag-prompt";
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
  const [answer, setAnswer] = useState("");
  const preview = useMutation(previewTagLibraryMutation);
  return (
    <>
      <PasteAnswer
        value={answer}
        onChange={setAnswer}
        pending={preview.isPending}
        label="Review the changes"
        onReview={() => preview.mutate({ answer })}
      />
      <ErrorText error={preview.error} />
      {preview.data && (
        <TagLibraryReview key={JSON.stringify(preview.data)} preview={preview.data} />
      )}
    </>
  );
}
