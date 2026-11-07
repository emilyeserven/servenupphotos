import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { type TagLibraryExport, tagLibraryQuery } from "@/api/tag-library";
import { CopyPromptButton, ErrorText } from "@/components/bulk-tagging/pick-controls";
import { LibraryAnswer, useFilteredNames } from "@/components/tag-library/library-answer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { count } from "@/components/update-data-shared";
import { downloadFile } from "@/lib/album-layout";
import { tagLibraryJson, tagLibraryPrompt } from "@/lib/tag-library-prompt";

/**
 * Tag library: reads every tag and every photo with its tags, copies them into one prompt (or
 * downloads them as JSON) for an LLM to overhaul the whole library, and reads its JSON answer back
 * into a review of every change before it's saved, waiting for Commit.
 */
export function TagLibraryCard() {
  const library = useQuery(tagLibraryQuery);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag library</CardTitle>
        <LibraryDescription minPhotos={library.data?.minPhotos} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LibraryStatus pending={library.isPending} error={library.error} data={library.data} />
        {library.data && <LibraryButtons data={library.data} />}
        <LibraryAnswer />
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
  const { ready, filtered } = useFilteredNames();
  return (
    <div className="flex flex-wrap gap-2">
      <CopyPromptButton
        label="Copy the library prompt"
        disabled={!ready}
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
