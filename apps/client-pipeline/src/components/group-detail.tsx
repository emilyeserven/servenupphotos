import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, ImageOffIcon } from "lucide-react";
import { useState } from "react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  albumAncestry,
  albumDescendants,
  groupLabel,
  organizeQuery,
  setAlbumParentMutation,
} from "@/api/organize";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { GroupCombobox } from "@/components/group-picker";
import { ImageLightbox } from "@/components/image-lightbox";
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
import {
  type CombinedPhoto,
  currentPhotos,
  photoImage,
  photoIn,
  photoText,
} from "@/lib/group-photos";
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

const LIST_ROUTES = { albums: "/albums", tags: "/tags" } as const;

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
  const children = albums.filter((a) => a.parent === album.id && a.id !== album.id);
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
      <dt className="text-muted-foreground">Sub-albums</dt>
      <dd>
        {children.length > 0 ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {children.map((child) => (
              <li key={child.id}>
                <AlbumLink album={child} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </dd>
    </>
  );
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
      Saved{" "}
      <a
        href={result.commitUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        the change
      </a>{" "}
      {result.newPullRequest ? "and opened" : "to"}{" "}
      <a
        href={result.pullRequestUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        #{result.pullRequestNumber}
      </a>
      .
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
        <PhotosBody combined={combined} photos={photos} />
      </CardContent>
    </Card>
  );
}

/** ALLPHOTOS.json from the combined data store, and its photos listing any of ids under kind. */
function useGroupPhotos(kind: GroupKind, ids: ReadonlySet<string>) {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  const photos = current ? current.photos.filter((photo) => photoIn(photo, kind, ids)) : undefined;
  return { combined, current, photos };
}

type GroupPhotosRead = ReturnType<typeof useGroupPhotos>;

function PhotosSource({ current }: Pick<GroupPhotosRead, "current">) {
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

function PhotosBody({ combined, photos }: Pick<GroupPhotosRead, "combined" | "photos">) {
  if (combined.isPending) return <p>Reading ALLPHOTOS.json…</p>;
  if (!photos) return <ReadError error={combined.error} />;
  if (photos.length === 0) return <NoPhotos />;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
      {newestFirst(photos).map((photo, i) => (
        <li key={`${photoText(photo, "file") ?? ""}-${i}`}>
          <PhotoTile photo={photo} />
        </li>
      ))}
    </ul>
  );
}

function ReadError({ error }: { error?: Error }) {
  return (
    <p className="text-destructive">{error ? error.message : "ALLPHOTOS.json couldn't be read."}</p>
  );
}

function NoPhotos() {
  return (
    <p className="text-muted-foreground">
      No photos yet. Add them on the{" "}
      <Link to="/gallery" className="text-foreground underline underline-offset-4">
        Gallery
      </Link>{" "}
      or a photo's page.
    </p>
  );
}

function newestFirst(photos: CombinedPhoto[]): CombinedPhoto[] {
  return photos.toSorted((a, b) =>
    (photoText(b, "createDate") ?? "").localeCompare(photoText(a, "createDate") ?? ""),
  );
}

/** What to call a photo: its title, or else its original file name. */
function photoName(photo: CombinedPhoto): string {
  return photoText(photo, "title") ?? photoText(photo, "file") ?? "Untitled";
}

/** The photo's Square Thumbnail, or else its smallest version. */
function squareUrl(photo: CombinedPhoto): string | undefined {
  return photoImage(photo, "thumbnail") ?? photoImage(photo, "small");
}

/** The photo at the largest size worth opening in a lightbox. */
function fullUrl(photo: CombinedPhoto): string | undefined {
  return photoImage(photo, "xlarge") ?? photoImage(photo, "full");
}

/** A photo's Square Thumbnail and title, opening the photo full size. */
function PhotoTile({ photo }: { photo: CombinedPhoto }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = photoName(photo);
  const square = squareUrl(photo);
  const full = fullUrl(photo);
  return (
    <figure className="flex flex-col gap-1.5">
      {square && !failed ? (
        <button
          type="button"
          title="Show it full size"
          disabled={!full}
          onClick={() => setOpen(true)}
          className="focus-visible:ring-ring bg-muted aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border outline-none focus-visible:ring-2"
        >
          <img
            src={square}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        </button>
      ) : (
        <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border text-xs">
          <ImageOffIcon className="size-5" aria-hidden />
          No image
        </div>
      )}
      <figcaption className="truncate text-xs" title={name}>
        {name}
      </figcaption>
      {full && (
        <ImageLightbox
          open={open}
          onClose={() => setOpen(false)}
          title={name}
          src={full}
          description={`${name} at full size.`}
        />
      )}
    </figure>
  );
}
