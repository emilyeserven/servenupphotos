import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { type OrganizeResponse, organizeQuery } from "@/api/organize";
import type { CombinedData } from "@/api/photos";
import { viewerLikes } from "@/api/viewer-likes";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { QueryResult, ReadingNote } from "@/components/query-result";
import { type SavedPhoto, useSavedPhotos } from "@/components/saved-photo-picker";
import { ListsCard } from "@/components/shared-likes/lists-card";
import { SharedPhotos } from "@/components/shared-likes/shared-photos";
import { Card, CardContent } from "@/components/ui/card";
import { sharedLikes } from "@/lib/shared-likes";
import { useCombinedData } from "@/stores/combined-data";
import { EmptyNote } from "@portfolio/components/empty-note";

/**
 * Shared Likes: the photos that are in every chosen Like list from User Likes (or in at least the
 * chosen number of them), put into one album, or split into suggested albums by location or by theme.
 */
export function SharedLikesPage() {
  return (
    <Page
      wide
      title="Shared Likes"
      description="Finds the photos several people all liked, from the Like lists on User Likes, and puts them into one album, or splits them into albums by where they were taken or by what they show."
    >
      <GitHubGate>{() => <Reads />}</GitHubGate>
    </Page>
  );
}

/** Reads the Like lists, the saved photos and the albums, tags and genres. */
function Reads() {
  const combined = useCombinedData();
  const organize = useQuery(organizeQuery);
  const saved = useSavedPhotos();
  return (
    <QueryResult query={combined} pendingLabel="Reading the photos and user likes…">
      {(data) => (
        <QueryResult query={organize} pendingLabel="Reading the albums, tags and genres…">
          {(groups) =>
            saved.pending ? (
              <ReadingNote label="Reading the saved photos…" />
            ) : (
              <SharedLikes data={data} organize={groups} saved={saved.photos} />
            )
          }
        </QueryResult>
      )}
    </QueryResult>
  );
}

const route = getRouteApi("/shared-likes");

interface SharedLikesProps {
  data: CombinedData;
  organize: OrganizeResponse;
  saved: SavedPhoto[];
}

/** The Like lists to compare, and the photos they share with their suggested albums. */
function SharedLikes({ data, organize, saved }: SharedLikesProps) {
  const search = route.useSearch();
  const viewers = viewerLikes(data);
  const skip = new Set(search.skip ?? []);
  const chosen = viewers.filter((viewer) => !skip.has(viewer.id));
  const shared = sharedLikes(chosen, search.atLeast);
  const byId = useMemo(() => savedById(saved), [saved]);
  if (viewers.length === 0) return <NoLists />;
  return (
    <div className="flex flex-col gap-6">
      <ListsCard viewers={viewers} chosen={chosen} shared={shared.length} />
      <SharedPhotos
        key={`${chosen.map((v) => v.id).join(",")}|${search.atLeast ?? ""}`}
        shared={shared}
        lists={chosen}
        saved={byId}
        organize={organize}
      />
    </div>
  );
}

/** The saved photos by photo ID, the ones waiting for Commit first. */
function savedById(saved: SavedPhoto[]): Map<number, SavedPhoto> {
  const out = new Map<number, SavedPhoto>();
  for (const photo of saved) {
    const id = photoId(photo);
    if (id !== undefined && !out.has(id)) out.set(id, photo);
  }
  return out;
}

/** The photo ID in a saved photo's JSON, when it has one. */
function photoId(photo: SavedPhoto): number | undefined {
  const id = (photo.file.data as { id?: unknown } | undefined)?.id;
  return typeof id === "number" ? id : undefined;
}

function NoLists() {
  return (
    <Card>
      <CardContent>
        <EmptyNote>
          No Like lists yet. Import each person&apos;s list on{" "}
          <Link to="/viewer-likes" className="text-foreground underline underline-offset-4">
            User Likes
          </Link>{" "}
          first.
        </EmptyNote>
      </CardContent>
    </Card>
  );
}
