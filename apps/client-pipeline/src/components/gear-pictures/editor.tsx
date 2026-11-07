import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { GearPicture } from "@portfolio/components/gear-graphics";
import type { GearFile } from "@portfolio/lib/gear-pictures";
import {
  deleteGearMutation,
  gearId,
  type GearRow,
  saveGearMutation,
  uploadGearImageMutation,
} from "@/api/gear";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { CropView, croppedFiles } from "@/components/gear-pictures/crop-view";
import {
  type GearPictureEditor,
  type GearPictureState,
  useGearPicture,
} from "@/components/gear-pictures/use-gear-picture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";

/**
 * The file the row's camera or lens saves: its saved file with the picture and description
 * changed, keeping the original and the crop its picture shows once one has been cut.
 */
function fileOf(row: GearRow, picture: GearPictureState, description: string): GearFile {
  const fresh = { id: gearId(row.kind, row.name), kind: row.kind, name: row.name };
  const { original: _o, crop: _c, ...saved } = { ...fresh, ...row.file };
  const next = { ...saved, image: picture.image, description: description.trim() };
  return picture.applied ? { ...next, original: picture.original, crop: picture.applied } : next;
}

/** What the card says about the camera or lens: its kind and how many photos name it. */
function usageText({ kind, photos }: GearRow): string {
  const what = kind === "camera" ? "A camera" : "A lens";
  return `${what} that ${photos} saved ${photos === 1 ? "photo names" : "photos name"}.`;
}

/**
 * Edits one camera's or lens's picture and description: a preview as the portfolio will show it,
 * a picture to upload (kept in R2 as it is) or the drawing instead, the crop lined up with the
 * `others`' crops, and Save and Remove, each a change waiting for Commit.
 */
export function GearEditor({ row, others }: { row: GearRow; others: GearFile[] }) {
  const editor = useGearPicture(row.file);
  const [description, setDescription] = useState(() => row.file?.description ?? "");
  const next = fileOf(row, editor.picture, description);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="break-words">{row.name}</CardTitle>
        <CardDescription>{usageText(row)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Preview row={row} image={editor.picture.image} />
        <ImageField editor={editor} />
        <CropView editor={editor} others={croppedFiles(others)} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Description, shown under the picture</span>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton next={next} saved={row.file} />
          <RemoveButton file={row.file} />
        </div>
      </CardContent>
    </Card>
  );
}

/** The picture as the portfolio's info panel will show it: the one chosen, or else the drawing. */
function Preview({ row, image }: { row: GearRow; image: string }) {
  return (
    <div className="bg-muted/40 flex min-h-36 items-center justify-center rounded-md border p-4">
      <div className="w-full max-w-60">
        <GearPicture kind={row.kind} name={row.name} image={image || undefined} />
      </div>
    </div>
  );
}

/** Picks a picture, which is put in R2 as soon as it's chosen and cut whole; or goes back to the drawing. */
function ImageField({ editor }: { editor: GearPictureEditor }) {
  const upload = useMutation(uploadGearImageMutation);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor="gear-image" className="font-medium">
        Picture (JPEG, PNG or WEBP; a PNG or WEBP keeps its transparent background)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="gear-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="max-w-80"
          disabled={upload.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file, { onSuccess: editor.uploaded });
          }}
        />
        <Busy busy={upload.isPending} />
        {editor.picture.original && (
          <Button variant="ghost" size="sm" onClick={editor.clear}>
            Use the drawing
          </Button>
        )}
      </div>
      <SaveNote error={upload.error} why="" />
    </div>
  );
}

/** Why the file can't be saved yet, or "" when it can. */
function whyNot(next: GearFile): string {
  return `${next.image}${next.description}` === "" ? "Add a picture or a description." : "";
}

/** Whether there's nothing to save: the file is as saved, or has nothing to show. */
function cantSave(next: GearFile, saved?: GearFile): boolean {
  return canonicalJson(next) === canonicalJson(saved ?? null) || whyNot(next) !== "";
}

/** What the save button says: Save changes for a saved file, or Save picture for a new one. */
const SAVE_LABELS = { saved: "Save changes", fresh: "Save picture" };

function SaveButton({ next, saved }: { next: GearFile; saved?: GearFile }) {
  const save = useMutation(saveGearMutation);
  const why = whyNot(next);
  return (
    <>
      <Button disabled={cantSave(next, saved) || save.isPending} onClick={() => save.mutate(next)}>
        <Busy busy={save.isPending} />
        {SAVE_LABELS[saved ? "saved" : "fresh"]}
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

/** Removes the saved file, so the portfolio goes back to the drawing; nothing before it's saved. */
function RemoveButton({ file }: { file?: GearFile }) {
  if (!file) return null;
  return <SavedRemoveButton id={file.id} />;
}

function SavedRemoveButton({ id }: { id: string }) {
  const remove = useMutation(deleteGearMutation);
  return (
    <RemoveEntryButton
      label="Remove picture"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}
