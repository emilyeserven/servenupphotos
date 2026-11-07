import { AlbumTreeCard } from "@/components/lightroom-albums/album-tree";
import { ImportCard } from "@/components/lightroom-albums/import-card";
import { NextUpCard } from "@/components/lightroom-albums/next-up";
import { PromptCard } from "@/components/lightroom-albums/prompt-card";
import { Page } from "@/components/page";

/**
 * The Lightroom Albums page: copies the prompt that reads Lightroom's album panel from screenshots, imports the
 * LLM's answer as a tree, and keeps a stage and notes on each album, only in this browser.
 */
export function LightroomAlbumsPage() {
  return (
    <Page
      wide
      title="Lightroom Albums"
      description="Your Lightroom folders and albums, read by an LLM from screenshots or a screen recording, with a stage and notes on each album. It's all kept in this browser only: nothing here goes to the backend or GitHub. Export it to pick up on another computer."
    >
      <NextUpCard />
      <PromptCard />
      <ImportCard />
      <AlbumTreeCard />
    </Page>
  );
}
