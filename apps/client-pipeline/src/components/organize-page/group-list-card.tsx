import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CornerDownRightIcon } from "lucide-react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  albumTree,
  groupLabel,
} from "@/api/organize";
import { AlbumMoveButtons } from "@/components/album-move-buttons";
import { HiddenMark } from "@/components/album-visibility-card";
import { ErrorNote } from "@/components/error-note";
import { GroupStatus } from "@/components/group-status";
import { QueryResult } from "@/components/query-result";
import { SmartMark } from "@/components/smart-album/smart-album-card";
import { FavoriteTagButton } from "@/components/tag-favorites";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePhotoCounts } from "@/hooks/use-photo-counts";
import { EmptyNote } from "@portfolio/components/empty-note";

/** Every album, tag or genre on the Albums, Tags or Photographic Genres page, in a table under its parent. */
export function GroupListCard({
  kind,
  organize,
  label,
}: {
  kind: GroupKind;
  organize: UseQueryResult<OrganizeResponse>;
  /** The page's title, which names the table. */
  label: string;
}) {
  const { plural } = GROUP_KINDS[kind];
  return (
    <Card>
      <CardHeader>
        <CardTitle>All {plural}</CardTitle>
        <CardDescription>
          {organize.data
            ? `On ${organize.data.branch} in ${organize.data.repo}, and in the open photo data pull request.`
            : "Reading them…"}
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={organize.isFetching}
            onClick={() => void organize.refetch()}
          >
            {organize.isFetching && <Spinner />}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <QueryResult query={organize} pendingLabel={`Reading ${plural}…`}>
          {(data) =>
            data[kind].length === 0 ? (
              <EmptyNote>No {plural} yet.</EmptyNote>
            ) : (
              <GroupTable
                kind={kind}
                groups={data[kind]}
                pullRequestUrl={data.pullRequest?.url}
                label={label}
              />
            )
          }
        </QueryResult>
      </CardContent>
    </Card>
  );
}

function GroupTable({
  kind,
  groups,
  pullRequestUrl,
  label,
}: {
  kind: GroupKind;
  groups: Group[];
  pullRequestUrl?: string;
  label: string;
}) {
  const countOf = usePhotoCounts(kind);
  // Each one is listed under its parent, the ones under it indented.
  const rows = albumTree(groups);
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>ID</TableHead>
          <TableHead className="text-right">Photos</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ group, depth }) => (
          <GroupRow
            key={group.path}
            kind={kind}
            group={group}
            depth={depth}
            count={countOf?.(group.id)}
            pullRequestUrl={pullRequestUrl}
            albums={kind === "albums" ? groups : undefined}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function GroupRow({
  kind,
  group,
  depth,
  count,
  pullRequestUrl,
  albums,
}: {
  kind: GroupKind;
  group: Group;
  depth: number;
  /** How many photos list it; undefined until ALLPHOTOS.json is read. */
  count?: number;
  pullRequestUrl?: string;
  /** Every album in its order, for an album's buttons to move it up or down. */
  albums?: Group[];
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="flex items-start gap-1" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          {depth > 0 && (
            <CornerDownRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <GroupName kind={kind} group={group} />
            <HiddenMark album={group} />
            <SmartMark album={group} />
            <GroupNote group={group} />
          </div>
          <FavoriteTagButton kind={kind} tag={group} />
          <AlbumMoveButtons album={group} albums={albums} />
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{group.id}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">{count ?? "…"}</TableCell>
      <TableCell className="text-xs">
        <GroupStatus inFlight={group.inFlight} pullRequestUrl={pullRequestUrl} />
      </TableCell>
    </TableRow>
  );
}

/** Each kind's page for one album, tag or genre. */
const GROUP_ROUTES = { albums: "/albums/$id", tags: "/tags/$id", genres: "/genres/$id" } as const;

/** The album or tag's name, linked to its page unless its file couldn't be read. */
function GroupName({ kind, group }: { kind: GroupKind; group: Group }) {
  if (group.error) return <span className="font-medium">{group.id}</span>;
  return (
    <Link
      to={GROUP_ROUTES[kind]}
      params={{ id: group.id }}
      className="font-medium underline-offset-4 hover:underline"
    >
      {groupLabel(group)}
    </Link>
  );
}

/** Why the file couldn't be read, or else its description, if any. */
function GroupNote({ group }: { group: Group }) {
  if (group.error) return <ErrorNote error={group.error} className="text-xs" />;
  if (!group.description) return null;
  return <p className="text-muted-foreground text-xs">{group.description}</p>;
}
