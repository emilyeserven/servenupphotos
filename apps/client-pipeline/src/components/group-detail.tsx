import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GROUP_KINDS, type Group, type GroupKind, groupLabel, organizeQuery } from "@/api/organize";
import { AboutCard } from "@/components/group-detail/about-card";
import { ParentCard } from "@/components/group-detail/parent-card";
import { GroupPhotosCard } from "@/components/group-detail/photos-card";
import type { GroupDetailProps } from "@/components/group-detail/types";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface GroupDetailPageProps {
  kind: GroupKind;
  /** The album's, tag's or genre's ID, from the address. */
  id: string;
  /** Links to the page's tabs, under the back button, such as an album's Photos, Info and Layout. */
  tabs?: ReactNode;
  /** What shows once the album, tag or genre is found; a tag's or genre's cards when left out. */
  children?: (found: GroupDetailProps) => ReactNode;
}

/** One album's, tag's or genre's page: what it is, where it sits, and the photos in it. */
export function GroupDetailPage({ kind, id, tabs, children = GroupColumns }: GroupDetailPageProps) {
  const organize = useQuery(organizeQuery);
  const group = organize.data?.[kind].find((g) => g.id === id);
  return (
    <Page wide {...pageHeading(kind, id, group)}>
      <Button variant="outline" size="sm" className="self-start" asChild>
        <Link to={LIST_ROUTES[kind]}>
          <ArrowLeftIcon />
          {capitalized(kind)}
        </Link>
      </Button>
      {tabs}
      <GitHubGate>
        {() => (
          <QueryResult query={organize} pendingLabel={`Reading the ${GROUP_KINDS[kind].singular}…`}>
            {(data) => (
              <GroupFound kind={kind} id={id} group={group} organize={data} render={children} />
            )}
          </QueryResult>
        )}
      </GitHubGate>
    </Page>
  );
}

const LIST_ROUTES = { albums: "/albums", tags: "/tags", genres: "/genres" } as const;

/** The page's title and description: the album or tag's, once it's found. */
function pageHeading(kind: GroupKind, id: string, group?: Group) {
  const { singular } = GROUP_KINDS[kind];
  if (!group) {
    return { title: capitalized(singular), description: `The ${singular} “${id}” and its photos.` };
  }
  return {
    title: groupLabel(group),
    description: group.description || `The photos in this ${singular}.`,
  };
}

interface GroupFoundProps extends Omit<GroupDetailProps, "group"> {
  id: string;
  group?: Group;
  render: (found: GroupDetailProps) => ReactNode;
}

function GroupFound({ kind, id, group, organize, render }: GroupFoundProps) {
  if (group) return render({ kind, group, organize });
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground">
          There's no {GROUP_KINDS[kind].singular} with the ID <code>{id}</code>.
        </p>
      </CardContent>
    </Card>
  );
}

function capitalized(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A tag's or genre's cards: what it is and its parent beside its photos. */
function GroupColumns({ kind, group, organize }: GroupDetailProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <AboutCard kind={kind} group={group} organize={organize} />
        {!group.error && <ParentCard kind={kind} group={group} organize={organize} />}
      </div>
      <GroupPhotosCard kind={kind} group={group} albums={organize.albums} />
    </div>
  );
}
