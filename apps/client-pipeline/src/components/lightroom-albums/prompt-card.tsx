import { useState } from "react";
import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { Segmented } from "@/components/lightroom-albums/segmented";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LightroomCapture, lightroomAlbumsPrompts } from "@/lib/lightroom-albums";

const CAPTURES: { value: LightroomCapture; label: string }[] = [
  { value: "screenshots", label: "Screenshots" },
  { value: "recording", label: "Screen recording" },
];

/** How to capture the album panel, as screenshots or a screen recording, and the prompt to send with it. */
export function PromptCard() {
  const [capture, setCapture] = useState<LightroomCapture>("screenshots");
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Read the albums with an LLM</CardTitle>
          <CardDescription>
            Works with Lightroom Classic&apos;s Collections panel and Lightroom&apos;s My Albums.
          </CardDescription>
        </div>
        <Segmented
          label="Capture the albums with"
          options={CAPTURES}
          value={capture}
          onChange={setCapture}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ol className="list-decimal space-y-1 ps-5">
          <li>Open every folder (collection set) you want, so the albums inside it show.</li>
          {capture === "screenshots" ? <ScreenshotSteps /> : <RecordingSteps />}
        </ol>
        <CopyPromptButton
          label={
            capture === "screenshots" ? "Copy the screenshots prompt" : "Copy the recording prompt"
          }
          disabled={false}
          prompt={() => lightroomAlbumsPrompts[capture]}
        />
      </CardContent>
    </Card>
  );
}

function ScreenshotSteps() {
  return (
    <>
      <li>
        Take a screenshot, then scroll down so the last two or three rows still show at the top, and
        take the next. Keep going to the bottom of the list.
      </li>
      <li>
        Send the screenshots to an LLM in order, with the prompt below, and paste its answer under{" "}
        <strong>Import</strong>.
      </li>
    </>
  );
}

function RecordingSteps() {
  return (
    <>
      <li>
        Record the screen while you scroll slowly from the top of the list to the bottom, pausing
        about half a second on each screenful.
      </li>
      <li>
        Send the recording to an LLM that reads video, with the prompt below, and paste its answer
        under <strong>Import</strong>.
      </li>
    </>
  );
}
