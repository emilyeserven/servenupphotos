import { ImportCard } from "@/components/lightroom-albums/import-card";
import { PromptCard } from "@/components/lightroom-albums/prompt-card";
import { Page } from "@/components/page";

/**
 * Lightroom Albums › Import: copies the prompt that reads Lightroom's album panel from screenshots or a screen
 * recording, and imports the LLM's answer or an exported file, or exports the list, all in this browser only.
 */
export function LightroomImportPage() {
  return (
    <Page
      wide
      title="Import Lightroom Albums"
      description="Have an LLM read your Lightroom folders and albums from screenshots or a screen recording, then paste its answer here. Export the list, with every stage and note, to pick up on another computer, and import that file there."
    >
      <PromptCard />
      <ImportCard />
    </Page>
  );
}
