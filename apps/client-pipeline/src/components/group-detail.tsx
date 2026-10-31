import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownUpIcon,
  ArrowLeftIcon,
  CheckIcon,
  CornerDownRightIcon,
  MinusIcon,
} from "lucide-react";
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
  type ParentKind,
  hasParents,
  setGroupParentMutation,
} from "@/api/organize";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import {
  type AlbumAdd,
  AlbumAddOutcome,
  AlbumAddPhotos,
  useAlbumAdd,
} from "@/components/album-add-photos";
import { AlbumDeleteCard } from "@/components/album-delete";
import { AlbumLayoutCard } from "@/components/album-layout/album-layout-card";
import { AlbumPhotoReorder } from "@/components/album-photo-reorder";
import {
  type AlbumRemove,
  AlbumRemoveOutcome,
  AlbumRemovePhotos,
  useAlbumRemove,
} from "@/components/album-remove-photos";
import { AlbumVisibilityCard } from "@/components/album-visibility-card";
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
    <>
      <GroupColumns kind={kind} group={group} organize={organize} />
      {kind === "albums" && !group.error && (
        <AlbumLayoutCard album={group} albums={organize.albums} />
      )}
    </>
  );
}

function GroupColumns({ kind, group, organize }: GroupDetailProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <AboutCard kind={kind} group={group} organize={organize} />
        {hasParents(kind) && !group.error && (
          <ParentCard kind={kind} group={group} organize={organize} />
        )}
        {kind === "albums" && <AlbumSideCards album={group} albums={organize.albums} />}
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
          {hasParents(kind) && <GroupPlace kind={kind} group={group} list={organize[kind]} />}
        </dl>
      </CardContent>
    </Card>
  );
}

/** How each kind with parents names where one sits. */
const PLACE_TEXT: Record<ParentKind, { label: string; top: string }> = {
  albums: { label: "Inside", top: "Nothing: it's a top-level album" },
  tags: { label: "Under", top: "Nothing: it's a top-level tag" },
};

/**
 * An album's cards under its parent: whether the portfolio shows it, its sub-albums, and deleting
 * it.
 */
function AlbumSideCards({ album, albums }: { album: Group; albums: Group[] }) {
  return (
    <>
      {!album.error && <AlbumVisibilityCard album={album} albums={albums} />}
      <SubAlbumsCard album={album} albums={albums} />
      {!album.error && <AlbumDelete album={album} albums={albums} />}
    </>
  );
}

/** The albums an album is inside, or the tags a tag is under, as rows of AboutCard's list. */
function GroupPlace({ kind, group, list }: { kind: ParentKind; group: Group; list: Group[] }) {
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
function NoParent({ kind, parent }: { kind: ParentKind; parent?: string }) {
  if (!parent) return <span className="text-muted-foreground">{PLACE_TEXT[kind].top}</span>;
  return (
    <span className="text-destructive">
      <code>{parent}</code>, which isn't {kind === "albums" ? "an album" : "a tag"}
    </span>
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

/** The album's Delete album card, with how many photos list it. */
function AlbumDelete({ album, albums }: { album: Group; albums: Group[] }) {
  const countOf = useAlbumPhotoCounts();
  return <AlbumDeleteCard album={album} albums={albums} photoCount={countOf?.(album.id)} />;
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
        <GroupLink kind="albums" group={album} />
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

function GroupLink({ kind, group }: { kind: ParentKind; group: Group }) {
  return (
    <Link
      to={kind === "albums" ? "/albums/$id" : "/tags/$id"}
      params={{ id: group.id }}
      className="underline-offset-4 hover:underline"
    >
      {groupLabel(group)}
    </Link>
  );
}

/** How the parent card describes each kind's parent. */
const PARENT_TEXT: Record<ParentKind, { title: string; description: string; none: string }> = {
  albums: {
    title: "Parent album",
    description: "An album can be inside one other album.",
    none: "None: a top-level album",
  },
  tags: {
    title: "Parent tag",
    description:
      "A tag can be under one more general tag, such as shotengai under covered-street, so filtering by the parent shows its photos too.",
    none: "None: a top-level tag",
  },
};

/** Picks the album's or tag's one parent, leaving out itself and the ones under it, and saves it. */
function ParentCard({
  kind,
  group,
  organize,
}: {
  kind: ParentKind;
  group: Group;
  organize: OrganizeResponse;
}) {
  const saved = group.parent ? [group.parent] : [];
  const [parent, setParent] = useState<string[]>(saved);
  const { save, rebuild } = useParentSave(kind, Boolean(organize.pullRequest));
  const exclude = new Set([group.id, ...albumDescendants(organize[kind], group.id)]);
  const text = PARENT_TEXT[kind];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>
          {text.description} Saving changes its file as a change waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <GroupCombobox
          id={`${kind}-parent`}
          kind={kind}
          multiple={false}
          value={parent}
          exclude={exclude}
          disabled={save.isPending}
          placeholder={text.none}
          onChange={(next) => {
            save.reset();
            setParent(next);
          }}
        />
        <ParentButtons
          changed={parentChanged(parent, group)}
          pending={save.isPending}
          onSave={() => save.mutate({ id: group.id, parent: parent[0] ?? null })}
          onUndo={() => setParent(saved)}
        />
        <ParentOutcome save={save} rebuild={rebuild} kind={kind} />
      </CardContent>
    </Card>
  );
}

function parentChanged(parent: string[], album: Group): boolean {
  return (parent[0] ?? "") !== (album.parent ?? "");
}

/** Saves an album's or tag's parent, reading them again and following CI's rebuild after a change. */
function useParentSave(kind: ParentKind, hasPullRequest: boolean) {
  const { refetch } = useQuery(organizeQuery);
  const rebuild = useAllPhotosRebuild(hasPullRequest, () => {});
  const save = useMutation({
    ...setGroupParentMutation(kind),
    onSuccess: (result) => {
      if (!result.changed) return;
      void refetch();
      rebuild.afterPush();
    },
  });
  return { save, rebuild, kind };
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
function ParentOutcome({ save, rebuild, kind }: ParentSave) {
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
        <AllPhotosRebuild status={rebuild.status} file={GROUP_KINDS[kind].allFile} />
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
 * The photos ALLPHOTOS.json lists in the album or tag, in the album's order; for an album,
 * optionally with the ones in its sub-albums too, and a way to put them in order.
 */
function GroupPhotos({ kind, group, albums }: { kind: GroupKind; group: Group; albums: Group[] }) {
  const subAlbums = subAlbumIds(kind, group, albums);
  const [withSubAlbums, setWithSubAlbums] = useState(false);
  const [mode, setMode] = useState<PhotosMode>("view");
  const ids = new Set([group.id, ...(withSubAlbums ? subAlbums : [])]);
  const { combined, current, photos } = useGroupPhotos(kind, ids);
  const adding = useAlbumAdd();
  const removing = useAlbumRemove();

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Photos{photos && ` (${photos.length})`}</CardTitle>
        <CardDescription>
          <PhotosSource current={current} />
        </CardDescription>
        {mode === "view" && (
          <CardAction className="flex flex-col items-end gap-2">
            <AddPhotosButton kind={kind} group={group} add={adding.add} />
            <ReorderButton
              show={canReorder(kind, group, photos)}
              onClick={() => setMode("reorder")}
            />
            <RemoveButton
              show={canRemove(kind, group, photos)}
              onClick={() => {
                removing.reset();
                setMode("remove");
              }}
            />
            <SubAlbumsToggle
              show={subAlbums.size > 0}
              checked={withSubAlbums}
              onChange={setWithSubAlbums}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <AlbumAddOutcome {...adding} />
        <AlbumRemoveOutcome remove={removing} />
        <PhotosOrReorder
          group={group}
          combined={combined}
          photos={photos}
          mode={mode}
          remove={removing}
          onDone={() => setMode("view")}
        />
      </CardContent>
    </Card>
  );
}

/** The albums inside the album, at any depth; none for a tag or genre. */
function subAlbumIds(kind: GroupKind, group: Group, albums: Group[]): Set<string> {
  return kind === "albums" ? albumDescendants(albums, group.id) : new Set<string>();
}

/** Whether the group is an album, readable, with more than one photo to put in order. */
function canReorder(kind: GroupKind, group: Group, photos: unknown[] = []): boolean {
  return kind === "albums" && !group.error && photos.length > 1;
}

/** Whether an album's Photos card shows its photos, the tiles to reorder, or the ones to remove. */
type PhotosMode = "view" | "reorder" | "remove";

/** Whether the group is an album, readable, with photos to take out of it. */
function canRemove(kind: GroupKind, group: Group, photos: unknown[] = []): boolean {
  return kind === "albums" && !group.error && photos.length > 0;
}

interface PhotosOrReorderProps extends Pick<GroupPhotos, "combined" | "photos"> {
  group: Group;
  mode: PhotosMode;
  remove: AlbumRemove;
  onDone: () => void;
}

/**
 * The photos in the album's order, or, while reordering, the tiles to drag into a new one, or,
 * while removing, the tiles to pick.
 */
function PhotosOrReorder({ group, combined, photos, mode, remove, onDone }: PhotosOrReorderProps) {
  if (mode === "view" || !photos) {
    return <GroupPhotoGrid combined={combined} photos={photos} order={group.photoOrder} />;
  }
  if (mode === "reorder") {
    return <AlbumPhotoReorder album={group} photos={photos} onDone={onDone} />;
  }
  return <AlbumRemovePhotos album={group} photos={photos} remove={remove} onDone={onDone} />;
}

/** An album's Add photos button; none for a tag or genre, or an album that couldn't be read. */
function AddPhotosButton({
  kind,
  group,
  add,
}: { kind: GroupKind; group: Group } & Pick<AlbumAdd, "add">) {
  if (kind !== "albums" || group.error) return null;
  return <AlbumAddPhotos album={group} add={add} />;
}

function ReorderButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <ArrowDownUpIcon aria-hidden />
      Reorder
    </Button>
  );
}

function RemoveButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <MinusIcon aria-hidden />
      Remove photos
    </Button>
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
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Include sub-albums
    </label>
  );
}
