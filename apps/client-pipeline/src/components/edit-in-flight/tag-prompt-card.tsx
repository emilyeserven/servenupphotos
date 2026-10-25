import { useQuery } from "@tanstack/react-query";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { CopyPromptButton } from "@/components/edit-in-flight/copy-prompt-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tagPrompt } from "@/lib/tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Copies a prompt that asks an LLM for the photo's tags, as a comma-separated list to paste into
 * the Tags field, which adds them.
 */
export function TagPromptCard({ imageUrl }: { imageUrl: string }) {
  const organize = useQuery(organizeQuery);
  const combined = useCombinedData();
  const groups = metaGroups(combined.data);
  const data = organize.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggest tags</CardTitle>
        <CardDescription>
          Copies a prompt for a chat with an LLM, with a link to the photo&apos;s Small version and
          every tag to reuse. Paste the comma-separated list it answers with into Tags to add them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CopyPromptButton
          label="Copy tag prompt"
          disabled={!data}
          prompt={() => (data ? tagPrompt(imageUrl, { ...data, metaGroups: groups }) : "")}
          onCopied={() => {}}
        />
      </CardContent>
    </Card>
  );
}
