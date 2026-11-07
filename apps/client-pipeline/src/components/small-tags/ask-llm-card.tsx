import type { TagLibraryExport } from "@/api/tag-library";
import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { LibraryAnswer, useFilteredNames } from "@/components/tag-library/library-answer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type SmallTag, smallTagsPrompt } from "@/lib/small-tags";

interface AskLlmCardProps {
  library: TagLibraryExport;
  small: SmallTag[];
}

/**
 * Copies a prompt asking an LLM to fix only the small tags, with the whole library for context,
 * and reads its JSON answer back into the Tag library's review before it's saved.
 */
export function AskLlmCard({ library, small }: AskLlmCardProps) {
  const { ready, filtered } = useFilteredNames();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask an LLM</CardTitle>
        <CardDescription>
          Copy every small tag with its photos, and the whole tag library for context, into a chat
          with an LLM. It answers with tags to add to more photos, merges, renames and removals
          (with a note on the photos), in the Tag library&apos;s JSON. Paste it back to review each
          change before it&apos;s saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CopyPromptButton
          label={`Copy the prompt for ${small.length} small ${small.length === 1 ? "tag" : "tags"}`}
          disabled={!ready || small.length === 0}
          prompt={() => smallTagsPrompt(library, small, filtered())}
        />
        <LibraryAnswer />
      </CardContent>
    </Card>
  );
}
