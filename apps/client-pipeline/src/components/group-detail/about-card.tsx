import { Link } from "@tanstack/react-router";
import { GROUP_KINDS, type Group, type GroupKind, albumAncestry, groupLabel } from "@/api/organize";
import { ErrorNote } from "@/components/error-note";
import type { GroupDetailProps } from "@/components/group-detail/types";
import { GroupStatus } from "@/components/group-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** What the album, tag or genre is: its ID, file, status and the ones it sits in. */
export function AboutCard({ kind, group, organize }: GroupDetailProps) {
  const { singular } = GROUP_KINDS[kind];
  return (
    <Card>
      <CardHeader>
        <CardTitle>About this {singular}</CardTitle>
        <ErrorNote error={group.error} />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono text-xs leading-5 break-all">{group.id}</dd>
          <dt className="text-muted-foreground">File</dt>
          <dd className="break-all">
            <a
              href={group.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {group.path}
            </a>
          </dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <GroupStatus inFlight={group.inFlight} pullRequestUrl={organize.pullRequest?.url} />
          </dd>
          <GroupPlace kind={kind} group={group} list={organize[kind]} />
        </dl>
      </CardContent>
    </Card>
  );
}

/** How each kind with parents names where one sits. */
const PLACE_TEXT: Record<GroupKind, { label: string; top: string }> = {
  albums: { label: "Inside", top: "Nothing: it's a top-level album" },
  tags: { label: "Under", top: "Nothing: it's a top-level tag" },
  genres: { label: "Under", top: "Nothing: it's a top-level genre" },
};

/** The albums an album is inside, or the tags or genres one is under, as rows of AboutCard's list. */
function GroupPlace({ kind, group, list }: { kind: GroupKind; group: Group; list: Group[] }) {
  const parents = albumAncestry(list, group.id).slice(0, -1);
  return (
    <>
      <dt className="text-muted-foreground">{PLACE_TEXT[kind].label}</dt>
      <dd>
        {parents.length > 0 ? (
          parents.map((parent, i) => (
            <span key={parent.id}>
              {i > 0 && <span className="text-muted-foreground"> › </span>}
              <GroupLink kind={kind} group={parent} />
            </span>
          ))
        ) : (
          <NoParent kind={kind} parent={group.parent} />
        )}
      </dd>
    </>
  );
}

/** Says a group has no parent, or that the one it names isn't of its kind. */
function NoParent({ kind, parent }: { kind: GroupKind; parent?: string }) {
  if (!parent) return <span className="text-muted-foreground">{PLACE_TEXT[kind].top}</span>;
  return (
    <ErrorNote>
      <span>
        <code>{parent}</code>, which isn't{" "}
        {kind === "albums" ? "an album" : `a ${GROUP_KINDS[kind].singular}`}
      </span>
    </ErrorNote>
  );
}

/** Each kind's page for one album, tag or genre. */
const GROUP_LINKS = { albums: "/albums/$id", tags: "/tags/$id", genres: "/genres/$id" } as const;

/** The album's, tag's or genre's name, linked to its page. */
export function GroupLink({ kind, group }: { kind: GroupKind; group: Group }) {
  return (
    <Link
      to={GROUP_LINKS[kind]}
      params={{ id: group.id }}
      className="underline-offset-4 hover:underline"
    >
      {groupLabel(group)}
    </Link>
  );
}
