import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import {
  albumDescendants,
  type Group,
  organizeQuery,
  setAlbumLayoutMutation,
} from "@/api/organize";
import { AlbumImportDialog } from "@/components/album-layout/album-import-dialog";
import { CoverPicker } from "@/components/album-layout/cover-picker";
import { LayoutPreview } from "@/components/album-layout/layout-preview";
import { LayoutRows } from "@/components/album-layout/layout-rows";
import { useGroupPhotos } from "@/components/group-photo-grid";
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
import {
  type AlbumLayout,
  albumExportText,
  downloadFile,
  emptyRow,
  sameLayout,
  savedLayout,
} from "@/lib/album-layout";
import { albumPhotoOrder, photoId } from "@/lib/album-photo-order";
import type { CombinedPhoto } from "@/lib/group-photos";

/**
 * An album's cover photos and its rows of photos with Markdown text above and below each, as the
 * portfolio shows them, to edit, export as a JSON file and import from one, and save as the album
 * file's `covers` and `layout`, a change waiting for Commit.
 */
export function AlbumLayoutCard({ album, albums }: { album: Group; albums: Group[] }) {
  const [draft, setDraft] = useState(() => savedLayout(album));
  const pool = useAlbumPool(album, albums);
  const save = useLayoutSave();
  const edit = (next: AlbumLayout) => {
    save.reset();
    setDraft(next);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layout and covers</CardTitle>
        <CardDescription>
          How the portfolio shows this album: its covers on the Albums page, and its page as rows of
          up to 4 photos with text above and below each. The album's sub-albums' photos can be used
          too.
        </CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            title="Save what's in the editor as a JSON file"
            onClick={() => downloadFile(`${album.id}.album.json`, albumExportText(album, draft))}
          >
            <DownloadIcon aria-hidden />
            Export
          </Button>
          <AlbumImportDialog album={album} inAlbum={pool.ids} onImport={edit} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <CoverPicker
            covers={draft.covers}
            photos={pool.photos}
            byId={pool.byId}
            onChange={(covers) => edit({ ...draft, covers })}
          />
          <LayoutRows
            layout={draft.layout}
            photos={pool.photos}
            byId={pool.byId}
            onChange={(layout) => edit({ ...draft, layout })}
          />
          <LayoutSaveBar
            album={album}
            draft={draft}
            save={save}
            onUndo={() => edit(savedLayout(album))}
          />
        </div>
        <LayoutPreview draft={draft} photos={pool.photos} byId={pool.byId} />
      </CardContent>
    </Card>
  );
}

/** The photos the album's layout can use, its own and its sub-albums', in its order, by ID too. */
function useAlbumPool(album: Group, albums: Group[]) {
  const ids = new Set([album.id, ...albumDescendants(albums, album.id)]);
  const { photos = [] } = useGroupPhotos("albums", ids);
  const ordered = albumPhotoOrder(photos, album.photoOrder);
  const byId = new Map<number, CombinedPhoto>(
    ordered.flatMap((photo) => {
      const id = photoId(photo);
      return id === undefined ? [] : [[id, photo] as const];
    }),
  );
  return { photos: ordered, byId, ids: new Set(byId.keys()) };
}

/** Saves the covers and layout, then reads the albums again. */
function useLayoutSave() {
  const queryClient = useQueryClient();
  return useMutation({
    ...setAlbumLayoutMutation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey }),
  });
}

type LayoutSave = ReturnType<typeof useLayoutSave>;

interface LayoutSaveBarProps {
  album: Group;
  draft: AlbumLayout;
  save: LayoutSave;
  onUndo: () => void;
}

/** Save layout and Undo while the editor differs from the album's file, and what saving did. */
function LayoutSaveBar({ album, draft, save, onUndo }: LayoutSaveBarProps) {
  const changed = !sameLayout(draft, savedLayout(album));
  const blocked = draft.layout.some(emptyRow);
  const ready = [changed, !blocked, !save.isPending].every(Boolean);
  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!ready} onClick={() => save.mutate({ id: album.id, ...draft })}>
          {save.isPending && <Spinner />}
          Save layout
        </Button>
        <UndoButton show={changed} pending={save.isPending} onUndo={onUndo} />
        <BlockedNote show={blocked} />
      </div>
      <SaveOutcome save={save} />
    </div>
  );
}

function BlockedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-destructive text-xs">Give every row photos or text first.</span>;
}

function UndoButton({
  show,
  pending,
  onUndo,
}: {
  show: boolean;
  pending: boolean;
  onUndo: () => void;
}) {
  if (!show) return null;
  return (
    <Button variant="outline" disabled={pending} onClick={onUndo}>
      Undo
    </Button>
  );
}

function SaveOutcome({ save }: { save: LayoutSave }) {
  if (save.isError) return <p className="text-destructive">{save.error.message}</p>;
  if (!save.isSuccess) return null;
  return (
    <p className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>
        {save.data.files === 0 ? (
          "The album already had that layout, so nothing changed."
        ) : (
          <>
            Saved the layout in the app.{" "}
            <WaitingForCommit pullRequestUrl={save.data.pullRequestUrl} />
          </>
        )}
      </span>
    </p>
  );
}
