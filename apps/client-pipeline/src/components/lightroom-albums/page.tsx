import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { AlbumTreeCard } from "@/components/lightroom-albums/album-tree";
import { ImportCard } from "@/components/lightroom-albums/import-card";
import { NextUpCard } from "@/components/lightroom-albums/next-up";
import { Page } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lightroomAlbumsPrompt } from "@/lib/lightroom-albums";

/**
 * The Lightroom Albums page: copies the prompt that reads Lightroom's album panel from screenshots, imports the
 * LLM's answer as a tree, and keeps a stage and notes on each album, only in this browser.
 */
export function LightroomAlbumsPage() {
  return (
    <Page
      wide
      title="Lightroom Albums"
      description="Your Lightroom folders and albums, read from screenshots by an LLM, with a stage and notes on each album. It's all kept in this browser only: nothing here goes to the backend or GitHub. Export it to pick up on another computer."
    >
      <NextUpCard />
      <PromptCard />
      <ImportCard />
      <AlbumTreeCard />
    </Page>
  );
}

/** How to take the screenshots, and the prompt to send with them. */
function PromptCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Read the albums from screenshots</CardTitle>
        <CardDescription>
          Works with Lightroom Classic&apos;s Collections panel and Lightroom&apos;s My Albums.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ol className="list-decimal space-y-1 ps-5">
          <li>Open every folder (collection set) you want, so the albums inside it show.</li>
          <li>
            Take a screenshot, then scroll down so the last two or three rows still show at the top,
            and take the next. Keep going to the bottom of the list.
          </li>
          <li>
            Send the screenshots to an LLM in order, with the prompt below, and paste its answer
            under <strong>Import</strong>.
          </li>
        </ol>
        <CopyPromptButton
          label="Copy the prompt"
          disabled={false}
          prompt={() => lightroomAlbumsPrompt}
        />
      </CardContent>
    </Card>
  );
}
