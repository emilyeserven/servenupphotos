import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { type GroupKind, organizeQuery } from "@/api/organize";
import { photosInFlightQuery } from "@/api/photos";
import { dataFolder, settingsQuery } from "@/api/settings";
import { useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { GroupListCard } from "@/components/organize-page/group-list-card";
import { NewGroupCard } from "@/components/organize-page/new-group-card";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { FavoriteTagsCard } from "@/components/tag-favorites";
import { TagNamesCard } from "@/components/tag-names-card";
import { Card, CardContent } from "@/components/ui/card";

const PAGES: Record<GroupKind, { title: string; description: string }> = {
  albums: {
    title: "Albums",
    description:
      "Collections of photos, like categories. A photo is usually in one album, an album can be inside one parent album, and each album is its own JSON file. The arrows by each album set the order the portfolio lists them in.",
  },
  tags: {
    title: "Tags",
    description:
      "Labels for photos. A photo can have several tags, and each tag is its own JSON file.",
  },
  genres: {
    title: "Photographic Genres",
    description:
      "The kinds of photography a photo is, such as street, landscape or portrait. A photo can have several genres, a genre can be a subgenre of a broader one, each genre is its own JSON file, and the portfolio can filter by them. Reorganize Genres changes their order, names and subgenres.",
  },
};

/** The Albums, Tags or Photographic Genres page: a form to add one, then every one. */
export function GroupPage({ kind }: { kind: GroupKind }) {
  const page = PAGES[kind];

  return (
    <Page title={page.title} description={page.description}>
      <GitHubGate>{(folder) => <GroupCards kind={kind} folder={folder} />}</GitHubGate>
    </Page>
  );
}

/** children, given the data folder, once Settings have a GitHub repository and token. */
export function GitHubGate({ children }: { children: (folder: string) => ReactNode }) {
  const settings = useQuery(settingsQuery);
  return (
    <QueryResult query={settings} pendingLabel="Reading settings…">
      {(data) =>
        data.github.repo && data.github.token.set ? (
          children(dataFolder(data.github.folder))
        ) : (
          <Card>
            <CardContent>
              <p className="text-muted-foreground">
                Not set up: add the GitHub repository and token in{" "}
                <Link to="/settings" className="text-foreground underline underline-offset-4">
                  Settings
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        )
      }
    </QueryResult>
  );
}

function GroupCards({ kind, folder }: { kind: GroupKind; folder: string }) {
  const queryClient = useQueryClient();
  const organize = useQuery(organizeQuery);
  const rebuild = useAllPhotosRebuild(Boolean(organize.data?.pullRequest), () => {
    void organize.refetch();
  });
  const onSaved = () => {
    void organize.refetch();
    void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
    rebuild.afterPush();
  };

  return (
    <>
      {kind === "tags" && <FavoriteTagsCard organize={organize.data} />}
      <NewGroupCard
        kind={kind}
        folder={folder}
        organize={organize.data}
        rebuild={rebuild}
        onSaved={onSaved}
      />
      {kind === "tags" && <TagNamesCard organize={organize.data} onSaved={onSaved} />}
      <GroupListCard kind={kind} organize={organize} label={PAGES[kind].title} />
    </>
  );
}
