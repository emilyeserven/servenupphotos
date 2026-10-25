import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, CornerDownRightIcon } from "lucide-react";
import { useState } from "react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  albumAncestry,
  albumDescendants,
  albumTree,
  groupLabel,
  organizeQuery,
  setAlbumParentMutation,
} from "@/api/organize";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { type GroupPhotos, GroupPhotoGrid, useGroupPhotos } from "@/components/group-photo-grid";
import { GroupCombobox } from "@/components/group-picker";
import { GitHubGate, GroupStatus } from "@/components/organize-page";
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
import { Spinner } from "@/components/ui/spinner";
import { currentPhotos, photoCounts } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

/** One album's or tag's page: what it is, where an album sits, and the photos in it. */
export function GroupDetailPage({ kind, id }: { kind: GroupKind; id: string }) {
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
      <GitHubGate>
        {() => (
          <QueryResult
            query={organize}
            pendingLabel={`Reading the ${GROUP_KINDS[kind].singular} from GitHub…`}
          >
            {(data) => <GroupFound kind={kind} id={id} group={group} organize={data} />}
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

function GroupFound({
  kind,
  id,
  group,
  organize,
}: { id: string; group?: Group } & Omit<GroupDetailProps, "group">) {
  if (group) return <GroupDetail kind={kind} group={group} organize={organize} />;
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground">
          There's no {GROUP_KINDS[kind].singular} with the ID <code>{id}</code> on GitHub.
        </p>
      </CardContent>
    </Card>
  );
}

function capitalized(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

interface GroupDetailProps {
  kind: GroupKind;
  group: Group;
  organize: OrganizeResponse;
}

function GroupDetail({ kind, group, organize }: GroupDetailProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <AboutCard kind={kind} group={group} organize={organize} />
        {kind === "albums" && !group.error && <ParentCard album={group} organize={organize} />}
        {kind === "albums" && <SubAlbumsCard album={group} albums={organize.albums} />}
      </div>
      <GroupPhotos kind={kind} group={group} albums={organize.albums} />
    </div>
  );
}

function AboutCard({ kind, group, organize }: GroupDetailProps) {
  const { singular } = GROUP_KINDS[kind];
  return (
    <Card>
      <CardHeader>
        <CardTitle>About this {singular}</CardTitle>
        {group.error && (
          <CardDescription className="text-destructive">{group.error}</CardDescription>
        )}
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
          {kind === "albums" && <AlbumPlace album={group} albums={organize.albums} />}
        </dl>
      </CardContent>
    </Card>
  );
}

/** The albums an album is inside, and the ones inside it, as rows of AboutCard's list. */
function AlbumPlace({ album, albums }: { album: Group; albums: Group[] }) {
  const parents = albumAncestry(albums, album.id).slice(0, -1);
  return (
    <>
      <dt className="text-muted-foreground">Inside</dt>
      <dd>
        {parents.length > 0 ? (
          parents.map((parent, i) => (
            <span key={parent.id}>
              {i > 0 && <span className="text-muted-foreground"> › </span>}
              <AlbumLink album={parent} />
            </span>
          ))
        ) : album.parent ? (
          <span className="text-destructive">
            <code>{album.parent}</code>, which isn't an album
          </span>
        ) : (
          <span className="text-muted-foreground">Nothing: it's a top-level album</span>
        )}
      </dd>
    </>
  );
}

/** Every album inside this one, at any depth, each under its parent, with how many photos it has. */
function SubAlbumsCard({ album, albums }: { album: Group; albums: Group[] }) {
  const inside = albumDescendants(albums, album.id);
  // The album's own row comes first; the rest are its sub-albums, one level less deep.
  const rows = albumTree(albums.filter((a) => a.id === album.id || inside.has(a.id))).slice(1);
  const countOf = useAlbumPhotoCounts();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sub-albums{rows.length > 0 && ` (${rows.length})`}</CardTitle>
        <CardDescription>
          Albums inside this one. To add one, give it this album as its parent.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map(({ group, depth }) => (
              <SubAlbumRow
                key={group.id}
                album={group}
                depth={depth - 1}
                count={countOf?.(group.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** How many photos in ALLPHOTOS.json list an album, by ID; undefined until it's read. */
function useAlbumPhotoCounts(): ((id: string) => number) | undefined {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  if (!current) return undefined;
  const counts = photoCounts(current.photos, "albums");
  return (id) => counts.get(id) ?? 0;
}

function SubAlbumRow({ album, depth, count }: { album: Group; depth: number; count?: number }) {
  return (
    <li
      className="flex items-start gap-2 py-2 first:pt-0 last:pb-0"
      style={{ paddingLeft: `${depth * 1.25}rem` }}
    >
      {depth > 0 && (
        <CornerDownRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <AlbumLink album={album} />
        {album.description && (
          <p className="text-muted-foreground truncate text-xs">{album.description}</p>
        )}
      </div>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {photoCountText(count)}
      </span>
    </li>
  );
}

function photoCountText(count?: number): string {
  if (count === undefined) return "…";
  return count === 1 ? "1 photo" : `${count} photos`;
}

function AlbumLink({ album }: { album: Group }) {
  return (
    <Link to="/albums/$id" params={{ id: album.id }} className="underline-offset-4 hover:underline">
      {groupLabel(album)}
    </Link>
  );
}

/** Picks the album's one parent, leaving out itself and its sub-albums, and saves it. */
function ParentCard({ album, organize }: { album: Group; organize: OrganizeResponse }) {
  const saved = album.parent ? [album.parent] : [];
  const [parent, setParent] = useState<string[]>(saved);
  const { save, rebuild } = useParentSave(Boolean(organize.pullRequest));
  const exclude = new Set([album.id, ...albumDescendants(organize.albums, album.id)]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parent album</CardTitle>
        <CardDescription>
          An album can be inside one other album. Saving changes its file in the open photo data
          pull request, or opens a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <GroupCombobox
          id="album-parent"
          kind="albums"
          multiple={false}
          value={parent}
          exclude={exclude}
          disabled={save.isPending}
          placeholder="None: a top-level album"
          onChange={(next) => {
            save.reset();
            setParent(next);
          }}
        />
        <ParentButtons
          changed={parentChanged(parent, album)}
          pending={save.isPending}
          onSave={() => save.mutate({ id: album.id, parent: parent[0] ?? null })}
          onUndo={() => setParent(saved)}
        />
        <ParentOutcome save={save} rebuild={rebuild} />
      </CardContent>
    </Card>
  );
}

function parentChanged(parent: string[], album: Group): boolean {
  return (parent[0] ?? "") !== (album.parent ?? "");
}

/** Saves an album's parent, reading the albums again and following CI's rebuild after a change. */
function useParentSave(hasPullRequest: boolean) {
  const { refetch } = useQuery(organizeQuery);
  const rebuild = useAllPhotosRebuild(hasPullRequest, () => {});
  const save = useMutation({
    ...setAlbumParentMutation,
    onSuccess: (result) => {
      if (!result.changed) return;
      void refetch();
      rebuild.afterPush();
    },
  });
  return { save, rebuild };
}

type ParentSave = ReturnType<typeof useParentSave>;

interface ParentButtonsProps {
  changed: boolean;
  pending: boolean;
  onSave: () => void;
  onUndo: () => void;
}

function ParentButtons({ changed, pending, onSave, onUndo }: ParentButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={!changed || pending} onClick={onSave}>
        {pending && <Spinner />}
        Save parent
      </Button>
      {changed && (
        <Button variant="outline" disabled={pending} onClick={onUndo}>
          Undo
        </Button>
      )}
    </div>
  );
}

/** What saving the parent did, or why it failed. */
function ParentOutcome({ save, rebuild }: ParentSave) {
  if (save.isError) return <p className="text-destructive">{save.error.message}</p>;
  if (!save.isSuccess) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          <ParentSavedText result={save.data} />
        </span>
      </p>
      {save.data.changed && (
        <AllPhotosRebuild status={rebuild.status} file={GROUP_KINDS.albums.allFile} />
      )}
    </div>
  );
}

function ParentSavedText({ result }: { result: NonNullable<ParentSave["save"]["data"]> }) {
  if (!result.changed) return "It already had that parent, so nothing changed.";
  return (
    <>
      Saved the change in the app. <WaitingForCommit pullRequestUrl={result.pullRequestUrl} />
    </>
  );
}

/**
 * The photos ALLPHOTOS.json lists in the album or tag, newest first; for an album, optionally with
 * the ones in its sub-albums too.
 */
function GroupPhotos({ kind, group, albums }: { kind: GroupKind; group: Group; albums: Group[] }) {
  const subAlbums = kind === "albums" ? albumDescendants(albums, group.id) : new Set<string>();
  const [withSubAlbums, setWithSubAlbums] = useState(false);
  const ids = new Set([group.id, ...(withSubAlbums ? subAlbums : [])]);
  const { combined, current, photos } = useGroupPhotos(kind, ids);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Photos{photos && ` (${photos.length})`}</CardTitle>
        <CardDescription>
          <PhotosSource current={current} />
        </CardDescription>
        <SubAlbumsToggle
          show={subAlbums.size > 0}
          checked={withSubAlbums}
          onChange={setWithSubAlbums}
        />
      </CardHeader>
      <CardContent className="text-sm">
        <GroupPhotoGrid combined={combined} photos={photos} />
      </CardContent>
    </Card>
  );
}

function PhotosSource({ current }: Pick<GroupPhotos, "current">) {
  if (!current) return "Every photo whose JSON lists it.";
  return (
    <>
      From{" "}
      <a
        href={current.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        ALLPHOTOS.json
      </a>{" "}
      on {current.where}, which CI rebuilds after each save, so a new change shows here once it's
      done.
    </>
  );
}

interface SubAlbumsToggleProps {
  show: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SubAlbumsToggle({ show, checked, onChange }: SubAlbumsToggleProps) {
  if (!show) return null;
  return (
    <CardAction>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        Include sub-albums
      </label>
    </CardAction>
  );
}
