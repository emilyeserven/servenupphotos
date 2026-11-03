import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type TagLibrary,
  type TagLibraryExport,
  applyTagLibraryMutation,
  tagLibraryQuery,
} from "@/api/tag-library";
import { ErrorText } from "@/components/bulk-tagging/pick-controls";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { useTagSave } from "@/components/prune-tags/change-list";
import { AskLlmCard } from "@/components/small-tags/ask-llm-card";
import { SmallTagCard } from "@/components/small-tags/small-tag-card";
import { usePhotosById } from "@/components/small-tags/small-photos";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { CommitSuccess, count } from "@/components/update-data-shared";
import { smallTags } from "@/lib/small-tags";

/** The Small Tags page: every tag or subtag with fewer than 3 photos, to clean up one by one. */
export function SmallTagsPage() {
  return (
    <Page
      wide
      title="Small Tags"
      description="Every tag and subtag that fewer than 3 photos show when you filter by it (its own photos and those of the tags under it), with its photos. Remove it with a private note on its photos, rename it or merge it into another tag, add it to more photos, or copy a prompt for an LLM to suggest fixes. Each change waits for Commit."
    >
      <GitHubGate>{() => <SmallTags />}</GitHubGate>
    </Page>
  );
}

function SmallTags() {
  const library = useQuery(tagLibraryQuery);
  if (library.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Reading every tag and photo…
      </p>
    );
  }
  if (!library.data) return <ErrorText error={library.error} />;
  return <SmallTagList library={library.data} />;
}

/** One change to save to a tag, and what to say once it's saved. */
export type SaveChange = (change: TagLibrary, said: string) => void;

/** The small tags, each with its photos and what can be done to it, and what the last save did. */
function SmallTagList({ library }: { library: TagLibraryExport }) {
  const apply = useTagSave(applyTagLibraryMutation);
  const [last, setLast] = useState({ tag: "", said: "" });
  const [search, setSearch] = useState("");
  const photos = usePhotosById();
  const small = smallTags(library);
  const shown = small.filter((t) => `${t.tag} ${t.parent}`.includes(search.trim().toLowerCase()));
  const saveFor =
    (tag: string): SaveChange =>
    (change, said) => {
      setLast({ tag, said });
      apply.mutate(change);
    };
  return (
    <div className="flex flex-col gap-6">
      <AskLlmCard library={library} small={small} />
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {count(small.length, "tag")} with fewer than {library.minPhotos} photos, of{" "}
          {library.tags.length}, as the next Commit will have them.
        </p>
        <Input
          aria-label="Find a tag"
          placeholder="Find a tag or its parent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {apply.data && <CommitSuccess result={apply.data}>{last.said}</CommitSuccess>}
      {small.length === 0 && <AllBigEnough minPhotos={library.minPhotos} />}
      {shown.map((tag) => (
        <SmallTagCard
          key={tag.tag}
          small={tag}
          library={library}
          photos={photos}
          pending={apply.isPending}
          error={last.tag === tag.tag ? apply.error : null}
          onSave={saveFor(tag.tag)}
        />
      ))}
    </div>
  );
}

/** What the page shows once no tag is small. */
function AllBigEnough({ minPhotos }: { minPhotos: number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground">Every tag has at least {minPhotos} photos.</p>
      </CardContent>
    </Card>
  );
}
