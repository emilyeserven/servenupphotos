import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownUpIcon, ArrowLeftIcon, CheckIcon, MinusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  albumAncestry,
  albumDescendants,
  groupLabel,
  organizeQuery,
  setGroupParentMutation,
} from "@/api/organize";
import {
  type AlbumAdd,
  AlbumAddOutcome,
  AlbumAddPhotos,
  useAlbumAdd,
} from "@/components/album-add-photos";
import { AlbumPhotoReorder } from "@/components/album-photo-reorder";
import { AlbumPhotoGrid } from "@/components/album-remove-one";
import {
  type AlbumRemove,
  AlbumRemoveOutcome,
  AlbumRemovePhotos,
  useAlbumRemove,
} from "@/components/album-remove-photos";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { ErrorNote } from "@/components/error-note";
import { type GroupPhotos, useGroupPhotos } from "@/components/group-photo-grid";
import { GitHubGate, GroupStatus } from "@/components/organize-page";
import { Page } from "@/components/page";
import { GroupCombobox } from "@/components/photo-groups-card";
import { PhotoShapeFilter } from "@/components/photo-shape-filter";
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
import { WaitingForCommit } from "@/components/waiting-for-commit";
import type { PhotoShape } from "@/lib/aspect-ratio";
import { photosOfShape } from "@/lib/photo-shapes";
import { EmptyNote, NO_PHOTOS_MATCH } from "@portfolio/components/empty-note";
import { isSmartAlbum } from "@portfolio/lib/smart-albums";

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

/** The album, tag or genre a page shows, with every album, tag and genre it was read with. */
export interface GroupDetailProps {
  /** Whether it's an album, a tag or a genre. */
  kind: GroupKind;
  /** The album, tag or genre itself. */
  group: Group;
  /** Every album, tag and genre, and the open photo data pull request. */
  organize: OrganizeResponse;
}

/** Whether the group is an album whose file could be read. */
export function isReadableAlbum(kind: GroupKind, group: Group): boolean {
  return kind === "albums" && !group.error;
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

/** How the parent card describes each kind's parent. */
const PARENT_TEXT: Record<GroupKind, { title: string; description: string; none: string }> = {
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
  genres: {
    title: "Parent genre",
    description:
      "A genre can be a subgenre of one broader genre, such as Traditional architecture under Architecture, so filtering by the parent shows its photos too. To arrange every genre at once, use Reorganize Genres.",
    none: "None: a top-level genre",
  },
};

/** Picks the album's, tag's or genre's one parent, leaving out itself and the ones under it, and saves it. */
export function ParentCard({
  kind,
  group,
  organize,
}: {
  kind: GroupKind;
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
function useParentSave(kind: GroupKind, hasPullRequest: boolean) {
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
  if (save.isError) return <ErrorNote error={save.error} />;
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
export function GroupPhotosCard({
  kind,
  group,
  albums,
}: {
  kind: GroupKind;
  group: Group;
  albums: Group[];
}) {
  const subAlbums = subAlbumIds(kind, group, albums);
  const [withSubAlbums, setWithSubAlbums] = useState(false);
  const [mode, setMode] = useState<PhotosMode>("view");
  const [shape, setShape] = useState<PhotoShape>();
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
          shape={shape}
          onShape={setShape}
          mode={mode}
          remove={removing}
          removable={byHand(kind, group)}
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
  return byHand(kind, group) && photos.length > 0;
}

/**
 * Whether the group is a readable album whose photos are chosen by hand, not a Smart Album, whose
 * photos, covers and layout only its rules decide.
 */
export function byHand(kind: GroupKind, group: Group): boolean {
  return isReadableAlbum(kind, group) && !isSmartAlbum(group);
}

interface PhotosOrReorderProps extends Pick<GroupPhotos, "combined" | "photos"> {
  group: Group;
  /** The shape the quick filter shows alone while viewing, or undefined for every photo. */
  shape?: PhotoShape;
  onShape: (shape?: PhotoShape) => void;
  mode: PhotosMode;
  remove: AlbumRemove;
  /** Whether each of the album's own photos gets a button that takes it out of the album. */
  removable: boolean;
  onDone: () => void;
}

/**
 * The photos in the album's order, or, while reordering, the tiles to drag into a new one, or,
 * while removing, the tiles to pick.
 */
function PhotosOrReorder(props: PhotosOrReorderProps) {
  const { group, photos, mode, remove, onDone } = props;
  if (mode === "view" || !photos) return <ShapePhotoGrid {...props} />;
  if (mode === "reorder") {
    return <AlbumPhotoReorder album={group} photos={photos} onDone={onDone} />;
  }
  return <AlbumRemovePhotos album={group} photos={photos} remove={remove} onDone={onDone} />;
}

/** The orientation quick filter over the photos of the shape it picked, or a note when none match. */
function ShapePhotoGrid(props: PhotosOrReorderProps) {
  const { group, photos = [], shape, onShape } = props;
  const shown = photosOfShape(props.photos, shape);
  return (
    <>
      <PhotoShapeFilter photos={photos} value={shape} onChange={onShape} />
      {shown?.length === 0 && shape ? (
        <EmptyNote>{NO_PHOTOS_MATCH}</EmptyNote>
      ) : (
        <AlbumPhotoGrid {...props} photos={shown} album={group} />
      )}
    </>
  );
}

/** An album's Add photos button; none for a tag or genre, or an album that couldn't be read. */
function AddPhotosButton({
  kind,
  group,
  add,
}: { kind: GroupKind; group: Group } & Pick<AlbumAdd, "add">) {
  if (!byHand(kind, group)) return null;
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
