import { type UseMutationResult, useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  Maximize2Icon,
  PlusIcon,
  ScanFaceIcon,
  ShieldOffIcon,
} from "lucide-react";
import { detectFacesMutation, savedFacesQuery } from "@/api/faces";
import type { Editable } from "@/components/edit-in-flight/photo-json";
import type { Edit, Save } from "@/components/edit-in-flight/use-edit";
import { FaceList } from "@/components/face-pixelation/face-list";
import { FacePreview, type PreviewHandle } from "@/components/face-pixelation/face-preview";
import {
  type EditorParts,
  FullScreenEditor,
} from "@/components/face-pixelation/full-screen-editor";
import { PixelateActions } from "@/components/face-pixelation/pixelate-actions";
import { type FaceEditorState, useFaceEditor } from "@/components/face-pixelation/use-face-editor";
import { type PixelateSave, usePixelateSave } from "@/components/face-pixelation/use-pixelate-save";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { FaceBox } from "@/lib/face-boxes";
import { facesFromJson } from "@/lib/face-json";

interface FacePixelationCardProps {
  editable: Editable;
  edit: Edit;
  save: Save;
  /** The rest of the Photo page is saving. */
  disabled: boolean;
}

/**
 * Pixelates faces on every version of a photo already in R2: find them or draw a box over each,
 * set how coarse each one's blocks are with a live preview, then remake the versions.
 */
export function FacePixelationCard(props: FacePixelationCardProps) {
  // A photo pixelated before its areas were saved in its JSON has them only in R2, with its versions.
  const fromJson = facesFromJson(props.edit.savedData);
  const inR2 = useQuery({
    ...savedFacesQuery(props.editable.image.key),
    enabled: fromJson === undefined,
  });
  const saved = fromJson ?? inR2.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pixelate faces</CardTitle>
        <CardDescription>
          Hide faces behind blocks of color on every version and the Square Thumbnail. Find them, or
          drag on the photo to draw a box, then set each one's density (fewer blocks hide more) and
          shape. A keep area leaves what's under it unpixelated, such as hair over a face.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {saved ? (
          <PhotoFaceEditor saved={saved} {...props} />
        ) : (
          <QueryResult query={inR2} pendingLabel="Reading the pixelated faces from R2…">
            {() => null}
          </QueryResult>
        )}
      </CardContent>
    </Card>
  );
}

type DetectMutation = UseMutationResult<FaceBox[], Error, { key: string }>;

/** The face editor on the photo's own image, saving through the Photo page. */
function PhotoFaceEditor({
  editable,
  edit,
  save,
  disabled,
  saved,
}: FacePixelationCardProps & { saved: FaceBox[] }) {
  const pixelate = usePixelateSave(editable, edit, save);
  return (
    <FaceEditor image={editable.image} saved={saved} pixelate={pixelate} disabled={disabled} />
  );
}

interface FaceEditorProps {
  /** The JPEG in R2 whose versions are pixelated, drawn on and searched for faces. */
  image: { key: string; url: string };
  /** The areas saved for it. */
  saved: FaceBox[];
  /** The areas to start editing from; the saved ones when left out. */
  initial?: FaceBox[];
  pixelate: PixelateSave;
  disabled: boolean;
  /** More buttons for the toolbar, given the faces being edited. */
  tools?: (editor: FaceEditorState, locked: boolean) => ReactNode;
}

/**
 * Finding and drawing the areas to pixelate on an image in R2, with a live preview, and remaking its
 * versions with them: the photo's own on its Pixelate faces card, or its unedited original's.
 */
export function FaceEditor({ image, saved, initial, pixelate, disabled, tools }: FaceEditorProps) {
  const editor = useFaceEditor(saved, initial);
  const detect = useMutation(detectFacesMutation);
  const [fullScreen, setFullScreen] = useState(false);
  const preview = useRef<PreviewHandle>(null);
  const add = (keep: boolean) => editor.add(keep, preview.current?.visibleArea());
  const locked = disabled || pixelate.mutation.isPending;
  const find = () =>
    detect.mutate({ key: image.key }, { onSuccess: (found) => editor.addFound(found) });

  const parts: EditorParts = {
    toolbar: (
      <Toolbar
        editor={editor}
        detect={detect}
        locked={locked}
        onFind={find}
        onAdd={add}
        fullScreen={fullScreen}
        onFullScreen={() => setFullScreen(true)}
      >
        {tools?.(editor, locked)}
      </Toolbar>
    ),
    notes: <DetectNote detect={detect} />,
    preview: (
      <FacePreview
        ref={preview}
        src={image.url}
        faces={editor.faces}
        selected={editor.selected}
        onSelect={editor.setSelected}
        onFacesChange={editor.setFaces}
        onLoad={editor.onLoad}
        showBoxes={editor.showBoxes}
        locked={locked}
        maxHeight={previewHeight(fullScreen)}
      />
    ),
    list: (
      <FaceList
        faces={editor.faces}
        selected={editor.selected}
        onSelect={editor.setSelected}
        onFacesChange={editor.setFaces}
        disabled={locked}
      />
    ),
    actions: <PixelateActions editor={editor} saved={saved} pixelate={pixelate} locked={locked} />,
  };

  return (
    <>
      <FullScreenEditor open={fullScreen} onOpenChange={setFullScreen} parts={parts} />
      {fullScreen ? (
        <p className="text-muted-foreground text-sm">Editing in full screen…</p>
      ) : (
        <InlineEditor parts={parts} />
      )}
    </>
  );
}

/** How tall the photo may be: as tall as the window allows in full screen, 28rem in the card. */
function previewHeight(fullScreen: boolean): string {
  return fullScreen ? "calc(100dvh - 13rem)" : "28rem";
}

/** The face editor laid out in the card, one part under the other. */
function InlineEditor({ parts }: { parts: EditorParts }) {
  return (
    <div className="flex flex-col gap-4">
      {parts.toolbar}
      {parts.notes}
      {parts.preview}
      <p className="text-muted-foreground text-xs">
        The preview is drawn by the browser; the versions average each block exactly, so they can
        look a touch different. Arrow keys move a focused box (Shift for bigger steps).
      </p>
      {parts.list}
      {parts.actions}
    </div>
  );
}

interface ToolbarProps {
  editor: FaceEditorState;
  detect: DetectMutation;
  locked: boolean;
  onFind: () => void;
  /** Adds a box to pixelate, or with `keep` an area to keep, in the middle of the photo in view. */
  onAdd: (keep: boolean) => void;
  /** The editor already fills the window, so it has no Full screen button. */
  fullScreen: boolean;
  onFullScreen: () => void;
  /** More buttons, after Add a keep area. */
  children?: ReactNode;
}

/** Find faces, add a box by hand, and show or hide the boxes over the preview. */
function Toolbar({
  editor,
  detect,
  locked,
  onFind,
  onAdd,
  fullScreen,
  onFullScreen,
  children,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onFind} disabled={locked || detect.isPending}>
        {detect.isPending ? <Spinner /> : <ScanFaceIcon />}
        Find faces
      </Button>
      <AddButtons onAdd={onAdd} disabled={locked || !editor.canAdd} />
      {children}
      <BoxesToggle shown={editor.showBoxes} onToggle={editor.toggleBoxes} />
      <FullScreenButton hidden={fullScreen} onClick={onFullScreen} />
    </div>
  );
}

/** Adds a box to pixelate, or an area to keep as it is, in the middle of the photo in view. */
function AddButtons({ onAdd, disabled }: { onAdd: (keep: boolean) => void; disabled: boolean }) {
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onAdd(false)}>
        <PlusIcon />
        Add a box
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onAdd(true)}>
        <ShieldOffIcon />
        Add a keep area
      </Button>
    </>
  );
}

/** Opens the editor filling the window, for a bigger photo to draw on. */
function FullScreenButton({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  if (hidden) return null;
  return (
    <Button variant="outline" size="sm" className="ml-auto" onClick={onClick}>
      <Maximize2Icon />
      Full screen
    </Button>
  );
}

/** Shows or hides the boxes, to see the preview as the versions will look. */
function BoxesToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const Icon = shown ? EyeOffIcon : EyeIcon;
  return (
    <Button variant="outline" size="sm" aria-pressed={!shown} onClick={onToggle}>
      <Icon />
      {shown ? "Hide boxes" : "Show boxes"}
    </Button>
  );
}

/** What finding faces came back with. */
function foundText(found: FaceBox[]): string {
  if (found.length === 0) {
    return "No faces found. Faces turned away, small or partly hidden are easy to miss: draw a box over them.";
  }
  const count = found.length === 1 ? "1 face" : `${found.length} faces`;
  return `Found ${count}. Check each box, and draw any that were missed.`;
}

/** What finding faces came back with, or why it failed. */
function DetectNote({ detect }: { detect: DetectMutation }) {
  if (detect.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {detect.error.message}
      </p>
    );
  }
  if (!detect.data) return null;
  return <p className="text-muted-foreground text-sm">{foundText(detect.data)}</p>;
}
