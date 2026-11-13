import { useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { SavedPrompts } from "@/components/describe-style/saved-prompts";
import { StyleOptions } from "@/components/describe-style/style-options";
import { StylePhotos } from "@/components/describe-style/style-photos";
import { GridFilterBar, useGridFilters } from "@/components/gallery/grid-filters";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultStyleCount,
  samplePhotos,
  styleCount,
  stylePrompt,
  takenDay,
} from "@/lib/style-prompt";

/** The Describe my style page's content, once the photo files are read. */
export function DescribeStylePage() {
  return <DecidedPhotoFiles>{(photos) => <DescribeStyle photos={photos} />}</DecidedPhotoFiles>;
}

/** The photos in the order they were taken, oldest first, with undated ones at the end. */
function byDateTaken(photos: SocialPhoto[]): SocialPhoto[] {
  return photos.toSorted((a, b) => {
    const [dayA, dayB] = [takenDay(a.data), takenDay(b.data)];
    if (!dayA || !dayB) return Number(!dayA) - Number(!dayB);
    return dayA.localeCompare(dayB);
  });
}

/**
 * The portfolio Grid's filters, the photos they leave spread out (or shuffled) to the chosen
 * number, and the prompt that asks an LLM to describe the photographer's style from them.
 */
function DescribeStyle({ photos }: { photos: SocialPhoto[] }) {
  const sorted = useMemo(() => byDateTaken(photos), [photos]);
  const grid = useGridFilters(sorted, sorted);
  const [count, setCount] = useState(String(defaultStyleCount));
  const [seed, setSeed] = useState<number>();
  const [focus, setFocus] = useState("");
  // en-CA writes dates as YYYY-MM-DD, in the browser's own time zone.
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));
  const picked = samplePhotos(grid.shown, styleCount(count), seed);
  const prompt = stylePrompt({
    photos: picked,
    matching: grid.shown.length,
    filtered: grid.count > 0,
    focus,
    today,
  });
  return (
    <div className="flex flex-col gap-6">
      <SavedPrompts
        count={count}
        focus={focus}
        onLoad={(saved) => {
          setCount(saved.count);
          setFocus(saved.focus);
          setSeed(undefined);
        }}
      />
      <GridFilterBar photos={grid.photos} />
      <Card>
        <CardHeader>
          <CardTitle>
            {picked.length} of {grid.shown.length} photos
          </CardTitle>
          <CardDescription>
            The prompt links each photo&apos;s Small version, with its date, place, gear and genres.
            They&apos;re spread evenly across the photos the filters leave, oldest first, so a long
            trip or several years are covered from end to end. Shuffle picks others at random.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <StyleOptions
            count={count}
            matching={grid.shown.length}
            onCount={setCount}
            shuffled={seed !== undefined}
            onShuffle={() => setSeed(Math.floor(Math.random() * 2 ** 32))}
            onSpread={() => setSeed(undefined)}
          />
          <label className="flex flex-col gap-2 text-sm">
            Anything to focus on (optional)
            <Textarea
              placeholder="Such as: How has my street photography changed since 2020?"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
            />
          </label>
          <CopyPromptButton
            label={`Copy the style prompt for ${picked.length} photos`}
            disabled={picked.length === 0}
            prompt={() => prompt}
          />
          <StylePhotos photos={picked} />
        </CardContent>
      </Card>
      <PromptPreview prompt={prompt} />
    </div>
  );
}

/** The prompt as it will be copied, to read before pasting it into a chat with an LLM. */
function PromptPreview({ prompt }: { prompt: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The prompt</CardTitle>
        <CardDescription>
          Paste it into a chat with an LLM that can open links, such as Claude, ChatGPT or Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          readOnly
          aria-label="The style prompt"
          className="h-80 font-mono text-xs"
          value={prompt}
        />
      </CardContent>
    </Card>
  );
}
