import { useForm } from "@tanstack/react-form";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CornerDownRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  albumTree,
  createGroupMutation,
  findCollision,
  groupId,
  groupLabel,
  groupName,
  organizeQuery,
} from "@/api/organize";
import { type PublishResult, photosInFlightQuery } from "@/api/photos";
import { dataFolder, settingsQuery } from "@/api/settings";
import {
  AllPhotosRebuild,
  type RebuildWatch,
  useAllPhotosRebuild,
} from "@/components/all-photos-rebuild";
import { AlbumMoveButtons } from "@/components/album-move-buttons";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { GroupCombobox } from "@/components/group-picker";
import { TagNamesCard } from "@/components/tag-names-card";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentPhotos, photoCounts } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

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
};

/** The Albums or Tags page: a form to add one, then every one on GitHub. */
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
    <QueryResult query={settings} pendingLabel="Loading settings…">
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
      <NewGroupCard
        kind={kind}
        folder={folder}
        organize={organize.data}
        rebuild={rebuild}
        onSaved={onSaved}
      />
      {kind === "tags" && <TagNamesCard organize={organize.data} onSaved={onSaved} />}
      <GroupListCard kind={kind} organize={organize} />
    </>
  );
}

interface NewGroupCardProps {
  kind: GroupKind;
  folder: string;
  /** Every album and tag, to warn about a name or ID already taken; undefined until it's read. */
  organize?: OrganizeResponse;
  rebuild: RebuildWatch;
  onSaved: () => void;
}

function NewGroupCard(props: NewGroupCardProps) {
  const { singular } = GROUP_KINDS[props.kind];
  // Bumped by "Add another" to start a fresh form.
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<PublishResult | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New {singular}</CardTitle>
        <CardDescription>
          Saves the {singular} as one JSON file in the open photo data pull request, or opens a new
          one. Its name and ID can't be used by another album or tag.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {saved ? (
          <SavedGroup
            kind={props.kind}
            result={saved}
            rebuild={props.rebuild}
            onAnother={() => {
              setSaved(null);
              setFormKey((n) => n + 1);
            }}
          />
        ) : (
          <NewGroupForm
            key={formKey}
            {...props}
            onSaved={(result) => {
              setSaved(result);
              props.onSaved();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Per field, what to say when the album or tag `group`, of kind `what`, already has the value. */
const COLLISIONS = {
  id: (what: string, group: Group) =>
    `The ${what} “${group.name || group.id}” already has the ID “${group.id}”, made from this name.`,
  name: (what: string, group: Group) => `There's already a ${what} named “${group.name}”.`,
};

/** Why `value` can't be used for `field`, when an album or tag already has it. */
function collisionMessage(
  organize: OrganizeResponse | undefined,
  field: "id" | "name",
  value: string,
): string | undefined {
  const found = organize ? findCollision(organize, field, value) : undefined;
  return found && COLLISIONS[field](GROUP_KINDS[found.kind].singular, found.group);
}

/** Why `name` itself can't be used, before checking it against the albums and tags. */
function nameProblem(name: string): string | undefined {
  if (!name.trim()) return "Give it a name.";
  if (name.trim().length > 100) return "Keep the name to 100 characters.";
  if (!groupId(name)) return "Include a letter or number from a to z or 0 to 9, so it gets an ID.";
  return undefined;
}

/** Why `name` can't be used, including when an album or tag has it or the ID made from it. */
function validateName(organize: OrganizeResponse | undefined, name: string): string | undefined {
  return (
    nameProblem(name) ??
    collisionMessage(organize, "name", name) ??
    collisionMessage(organize, "id", groupId(name))
  );
}

function NewGroupForm({
  kind,
  folder,
  organize,
  onSaved,
}: Omit<NewGroupCardProps, "onSaved" | "rebuild"> & { onSaved: (result: PublishResult) => void }) {
  const create = useMutation({ ...createGroupMutation(kind), onSuccess: onSaved });

  const form = useForm({
    defaultValues: { name: "", description: "", parent: [] as string[] },
    validators: { onSubmit: ({ value }) => validateName(organize, value.name) },
    onSubmit: async ({ value }) => {
      await create
        .mutateAsync({
          id: groupId(value.name),
          name: groupName(kind, value.name),
          description: value.description.trim(),
          parent: value.parent[0],
        })
        .catch(() => {});
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{ onChange: ({ value }) => validateName(organize, value) }}
      >
        {(field) => {
          const error = field.state.meta.isTouched ? field.state.meta.errors[0] : undefined;
          return (
            <FormField
              id={field.name}
              label="Name"
              error={error}
              hint={<IdHint folder={folder} kind={kind} id={groupId(field.state.value)} />}
            >
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                disabled={create.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={`${field.name}-hint`}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  create.reset();
                  field.handleChange(event.target.value);
                }}
              />
            </FormField>
          );
        }}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <FormField id={field.name} label="Description" hint="Optional.">
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              disabled={create.isPending}
              aria-describedby={`${field.name}-hint`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </FormField>
        )}
      </form.Field>

      {kind === "albums" && (
        <form.Field name="parent">
          {(field) => (
            <FormField
              id={field.name}
              label="Parent album"
              hint="Optional. Puts this album inside another, as one of its sub-albums."
            >
              <GroupCombobox
                id={field.name}
                kind="albums"
                multiple={false}
                value={field.state.value}
                disabled={create.isPending}
                placeholder="None: a top-level album"
                aria-describedby={`${field.name}-hint`}
                onChange={(parent) => field.handleChange(parent)}
              />
            </FormField>
          )}
        </form.Field>
      )}

      {create.isError && <p className="text-destructive text-sm">{create.error.message}</p>}

      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button type="submit" className="self-start" disabled={!canSubmit || create.isPending}>
            {create.isPending && <Spinner />}
            {create.isPending ? "Saving…" : `Add ${GROUP_KINDS[kind].singular}`}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/** How the ID hint says where the ID comes from: a tag's name is its ID too. */
const ID_HINTS: Record<GroupKind, { lead: string; made: string }> = {
  albums: { lead: "ID", made: ", made from the name" },
  tags: { lead: "Saved as", made: ", in lowercase kebab-case, as its name and ID" },
};

/** The ID made from the name, which photos list it by, and the file it's saved as. */
function IdHint({ folder, kind, id }: { folder: string; kind: GroupKind; id: string }) {
  return (
    <>
      {ID_HINTS[kind].lead} <code>{id || "…"}</code>
      {ID_HINTS[kind].made}. Saves{" "}
      <code className="break-all">
        {folder}/{kind}/{id || "…"}.json
      </code>
      .
    </>
  );
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {error ? <span className="text-destructive">{error}</span> : hint}
        </p>
      )}
    </div>
  );
}

/** Where the new album or tag went, then how CI's rebuild of the combined file is going. */
function SavedGroup({
  kind,
  result,
  rebuild,
  onAnother,
}: {
  kind: GroupKind;
  result: PublishResult;
  rebuild: RebuildWatch;
  onAnother: () => void;
}) {
  const { singular, allFile } = GROUP_KINDS[kind];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Saved <code>{result.path}</code> in the app.{" "}
        <WaitingForCommit pullRequestUrl={result.pullRequestUrl} />
      </p>
      <AllPhotosRebuild status={rebuild.status} file={allFile} />
      <Button variant="outline" size="sm" className="self-start" onClick={onAnother}>
        Add another {singular}
      </Button>
    </div>
  );
}

function GroupListCard({
  kind,
  organize,
}: {
  kind: GroupKind;
  organize: UseQueryResult<OrganizeResponse>;
}) {
  const { plural } = GROUP_KINDS[kind];
  const title = PAGES[kind].title;
  return (
    <Card>
      <CardHeader>
        <CardTitle>All {plural}</CardTitle>
        <CardDescription>
          {organize.data
            ? `On ${organize.data.branch} in ${organize.data.repo}, and in the open photo data pull request.`
            : "Reading them from GitHub."}
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
        <QueryResult query={organize} pendingLabel={`Reading ${plural} from GitHub…`}>
          {(data) =>
            data[kind].length === 0 ? (
              <p className="text-muted-foreground text-sm">No {plural} yet.</p>
            ) : (
              <GroupTable
                kind={kind}
                groups={data[kind]}
                pullRequestUrl={data.pullRequest?.url}
                label={title}
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
  // Albums list each one under its parent in their order, sub-albums indented.
  const rows = kind === "albums" ? albumTree(groups) : groups.map((group) => ({ group, depth: 0 }));
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

/** How many photos in ALLPHOTOS.json list an album or tag, by ID; undefined until it's read. */
function usePhotoCounts(kind: GroupKind): ((id: string) => number) | undefined {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  if (!current) return undefined;
  const counts = photoCounts(current.photos, kind);
  return (id) => counts.get(id) ?? 0;
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
            <GroupNote group={group} />
          </div>
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

/** Each kind's page for one album or tag. */
const GROUP_ROUTES = { albums: "/albums/$id", tags: "/tags/$id" } as const;

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
  if (group.error) return <p className="text-destructive text-xs">{group.error}</p>;
  if (!group.description) return null;
  return <p className="text-muted-foreground text-xs">{group.description}</p>;
}

/** "In flight", linked to the pull request, or "Merged". */
export function GroupStatus({
  inFlight,
  pullRequestUrl,
}: {
  inFlight: boolean;
  pullRequestUrl?: string;
}) {
  if (!inFlight) return <span className="text-muted-foreground">Merged</span>;
  return (
    <a
      href={pullRequestUrl}
      target="_blank"
      rel="noreferrer"
      className="text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
    >
      In flight
    </a>
  );
}
