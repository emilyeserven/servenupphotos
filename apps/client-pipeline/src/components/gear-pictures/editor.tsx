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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";

/** The file the row's camera or lens saves: its saved file with the picture and description changed. */
function fileOf(row: GearRow, image: string, description: string): GearFile {
  const fresh = { id: gearId(row.kind, row.name), kind: row.kind, name: row.name };
  return { ...fresh, ...row.file, image, description: description.trim() };
}

/** What the card says about the camera or lens: its kind and how many photos name it. */
function usageText({ kind, photos }: GearRow): string {
  const what = kind === "camera" ? "A camera" : "A lens";
  return `${what} that ${photos} saved ${photos === 1 ? "photo names" : "photos name"}.`;
}

/**
 * Edits one camera's or lens's picture and description: a preview as the portfolio will show it,
 * a picture to upload (to R2 at once) or the drawing instead, and Save and Remove, each a change
 * waiting for Commit.
 */
export function GearEditor({ row }: { row: GearRow }) {
  const [image, setImage] = useState(() => savedField(row, "image"));
  const [description, setDescription] = useState(() => savedField(row, "description"));
  const next = fileOf(row, image, description);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="break-words">{row.name}</CardTitle>
        <CardDescription>{usageText(row)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Preview row={row} image={image} />
        <ImageField image={image} onImage={setImage} />
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

/** The saved file's picture or description, or "" when there's no saved file. */
function savedField(row: GearRow, field: "image" | "description"): string {
  return row.file?.[field] ?? "";
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

/** Picks a picture, which is resized and put in R2 as soon as it's chosen; or goes back to the drawing. */
function ImageField({ image, onImage }: { image: string; onImage: (url: string) => void }) {
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
            if (file) upload.mutate(file, { onSuccess: (res) => onImage(res.url) });
          }}
        />
        <Busy busy={upload.isPending} />
        {image && (
          <Button variant="ghost" size="sm" onClick={() => onImage("")}>
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
