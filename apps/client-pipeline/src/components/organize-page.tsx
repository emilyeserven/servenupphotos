import { useForm } from "@tanstack/react-form";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  createGroupMutation,
  findCollision,
  groupId,
  organizeQuery,
  validateGroupId,
} from "@/api/organize";
import { type PublishResult, photosInFlightQuery } from "@/api/photos";
import { dataFolder, settingsQuery } from "@/api/settings";
import {
  AllPhotosRebuild,
  type RebuildWatch,
  useAllPhotosRebuild,
} from "@/components/all-photos-rebuild";
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

const PAGES: Record<GroupKind, { title: string; description: string }> = {
  albums: {
    title: "Albums",
    description:
      "Collections of photos, like categories. A photo can be in several albums, and each album is its own JSON file.",
  },
  tags: {
    title: "Tags",
    description:
      "Labels for photos. A photo can have several tags, and each tag is its own JSON file.",
  },
};

/** The Albums or Tags page: a form to add one, then every one on GitHub. */
export function GroupPage({ kind }: { kind: GroupKind }) {
  const settings = useQuery(settingsQuery);
  const page = PAGES[kind];

  return (
    <Page title={page.title} description={page.description}>
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <GroupCards kind={kind} folder={dataFolder(data.github.folder)} />
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
    </Page>
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
    `The ${what} “${group.name || group.id}” already has this ID.`,
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

function validateName(organize: OrganizeResponse | undefined, name: string): string | undefined {
  if (!name.trim()) return "Give it a name.";
  if (name.trim().length > 100) return "Keep the name to 100 characters.";
  return collisionMessage(organize, "name", name);
}

function validateId(organize: OrganizeResponse | undefined, id: string): string | undefined {
  return validateGroupId(id) ?? collisionMessage(organize, "id", id);
}

function NewGroupForm({
  kind,
  folder,
  organize,
  onSaved,
}: Omit<NewGroupCardProps, "onSaved" | "rebuild"> & { onSaved: (result: PublishResult) => void }) {
  const create = useMutation({ ...createGroupMutation(kind), onSuccess: onSaved });
  // The ID follows the name until it's edited by hand.
  const [idEdited, setIdEdited] = useState(false);

  const form = useForm({
    defaultValues: { name: "", id: "", description: "" },
    validators: {
      onSubmit: ({ value }) => validateName(organize, value.name) ?? validateId(organize, value.id),
    },
    onSubmit: async ({ value }) => {
      await create
        .mutateAsync({
          id: value.id.trim(),
          name: value.name.trim(),
          description: value.description.trim(),
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
        {(field) => (
          <FormField
            id={field.name}
            label="Name"
            error={field.state.meta.isTouched ? field.state.meta.errors[0] : undefined}
          >
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              disabled={create.isPending}
              aria-invalid={Boolean(field.state.meta.isTouched && field.state.meta.errors[0])}
              onBlur={field.handleBlur}
              onChange={(event) => {
                create.reset();
                field.handleChange(event.target.value);
                if (!idEdited) form.setFieldValue("id", groupId(event.target.value));
              }}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="id" validators={{ onChange: ({ value }) => validateId(organize, value) }}>
        {(field) => {
          const error = field.state.value ? field.state.meta.errors[0] : undefined;
          return (
            <FormField
              id={field.name}
              label="ID"
              error={error}
              hint={
                <>
                  Photos list it by this. Saves{" "}
                  <code className="break-all">
                    {folder}/{kind}/{field.state.value.trim() || "…"}.json
                  </code>
                  .
                </>
              }
            >
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                disabled={create.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={`${field.name}-hint`}
                className="font-mono"
                onBlur={field.handleBlur}
                onChange={(event) => {
                  create.reset();
                  setIdEdited(event.target.value !== "");
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
        Saved{" "}
        <a
          href={result.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {result.path}
        </a>{" "}
        {result.newPullRequest ? "and opened" : "to the open pull request"}{" "}
        <a
          href={result.pullRequestUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          #{result.pullRequestNumber}
        </a>
        .
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
  groups,
  pullRequestUrl,
  label,
}: {
  groups: Group[];
  pullRequestUrl?: string;
  label: string;
}) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <GroupRow key={group.path} group={group} pullRequestUrl={pullRequestUrl} />
        ))}
      </TableBody>
    </Table>
  );
}

function GroupRow({ group, pullRequestUrl }: { group: Group; pullRequestUrl?: string }) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <a
          href={group.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-4 hover:underline"
        >
          {group.name || group.id}
        </a>
        <GroupNote group={group} />
      </TableCell>
      <TableCell className="font-mono text-xs">{group.id}</TableCell>
      <TableCell className="text-xs">
        <GroupStatus inFlight={group.inFlight} pullRequestUrl={pullRequestUrl} />
      </TableCell>
    </TableRow>
  );
}

/** Why the file couldn't be read, or else its description, if any. */
function GroupNote({ group }: { group: Group }) {
  if (group.error) return <p className="text-destructive text-xs">{group.error}</p>;
  if (!group.description) return null;
  return <p className="text-muted-foreground text-xs">{group.description}</p>;
}

/** "In flight", linked to the pull request, or "Merged". */
function GroupStatus({ inFlight, pullRequestUrl }: { inFlight: boolean; pullRequestUrl?: string }) {
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
