import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import {
  type TagLibraryExport,
  previewTagLibraryMutation,
  tagLibraryQuery,
} from "@/api/tag-library";
import { CopyPromptButton, ErrorText, PasteAnswer } from "@/components/bulk-tagging/pick-controls";
import { TagLibraryReview } from "@/components/tag-library/tag-library-review";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { count } from "@/components/update-data-shared";
import { downloadFile } from "@/lib/album-layout";
import { tagLibraryJson, tagLibraryPrompt } from "@/lib/tag-library-prompt";
import { filteredNames } from "@/lib/tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Tag library: reads every tag and every photo with its tags, copies them into one prompt (or
 * downloads them as JSON) for an LLM to overhaul the whole library, and reads its JSON answer back
 * into a review of every change before it's saved, waiting for Commit.
 */
export function TagLibraryCard() {
  const [answer, setAnswer] = useState("");
  const library = useQuery(tagLibraryQuery);
  const preview = useMutation(previewTagLibraryMutation);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag library</CardTitle>
        <LibraryDescription minPhotos={library.data?.minPhotos} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LibraryStatus pending={library.isPending} error={library.error} data={library.data} />
        {library.data && <LibraryButtons data={library.data} />}
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
      </CardContent>
    </Card>
  );
}

/** What the Tag library does, keeping each tag to at least minPhotos photos. */
function LibraryDescription({ minPhotos = 3 }: { minPhotos?: number }) {
  return (
    <CardDescription>
      Copy every tag and every photo with its tags into a chat with an LLM, which suggests new tags,
      renames, merges, removals, new parents, descriptions and each photo&apos;s tag changes,
      keeping every tag to at least {minPhotos} photos and writing a private note on the photos when
      a tag goes or isn&apos;t made. Paste its JSON answer back and review the changes before
      they&apos;re saved, waiting for Commit.
    </CardDescription>
  );
}

interface LibraryStatusProps {
  pending: boolean;
  error: Error | null;
  data: TagLibraryExport | undefined;
}

/** What the read found: how many tags and photos, and the files it couldn't read. */
function LibraryStatus({ pending, error, data }: LibraryStatusProps) {
  if (pending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Reading every tag and photo…
      </p>
    );
  }
  if (!data) return <ErrorText error={error} />;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        {count(data.tags.length, "tag")} and {count(data.photos.length, "photo")}, as the next
        Commit will have them.
      </p>
      {data.unreadable.length > 0 && (
        <p className="text-destructive">
          Left out, since they couldn&apos;t be read: {data.unreadable.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Copies the prompt with the whole library, or downloads the library as JSON. */
function LibraryButtons({ data }: { data: TagLibraryExport }) {
  const organize = useQuery(organizeQuery);
  const combined = useCombinedData();
  const filtered = () =>
    organize.data ? filteredNames({ ...organize.data, metaGroups: metaGroups(combined.data) }) : [];
  return (
    <div className="flex flex-wrap gap-2">
      <CopyPromptButton
        label="Copy the library prompt"
        disabled={!organize.data}
        prompt={() => tagLibraryPrompt(data, filtered())}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => downloadFile("tag-library.json", tagLibraryJson(data))}
      >
        <DownloadIcon />
        Download the library JSON
      </Button>
    </div>
  );
}
