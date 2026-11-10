import { type UseMutationResult, useMutation, useQuery } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon, PlusIcon, ScanFaceIcon } from "lucide-react";
import { detectFacesMutation, savedFacesQuery } from "@/api/faces";
import type { Editable } from "@/components/edit-in-flight/photo-json";
import type { Edit, Save } from "@/components/edit-in-flight/use-edit";
import { FaceList } from "@/components/face-pixelation/face-list";
import { FacePreview } from "@/components/face-pixelation/face-preview";
import { PixelateActions } from "@/components/face-pixelation/pixelate-actions";
import { type FaceEditorState, useFaceEditor } from "@/components/face-pixelation/use-face-editor";
import { usePixelateSave } from "@/components/face-pixelation/use-pixelate-save";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { FaceBox } from "@/lib/face-boxes";

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
  const saved = useQuery(savedFacesQuery(props.editable.image.key));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pixelate faces</CardTitle>
        <CardDescription>
          Hide faces behind blocks of color on every version and the Square Thumbnail. Find them, or
          drag on the photo to draw a box, then set each one's density: fewer blocks hide more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={saved} pendingLabel="Reading the pixelated faces from R2…">
          {(faces) => <FaceEditor saved={faces} {...props} />}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

type DetectMutation = UseMutationResult<FaceBox[], Error, { key: string }>;

function FaceEditor({
  editable,
  edit,
  save,
  disabled,
  saved,
}: FacePixelationCardProps & { saved: FaceBox[] }) {
  const editor = useFaceEditor(saved);
  const detect = useMutation(detectFacesMutation);
  const pixelate = usePixelateSave(editable, edit, save);
  const locked = disabled || pixelate.mutation.isPending;
  const find = () =>
    detect.mutate({ key: editable.image.key }, { onSuccess: (found) => editor.addFound(found) });

  return (
    <div className="flex flex-col gap-4">
      <Toolbar editor={editor} detect={detect} locked={locked} onFind={find} />
      <DetectNote detect={detect} />
      <FacePreview
        src={editable.image.url}
        faces={editor.faces}
        selected={editor.selected}
        onSelect={editor.setSelected}
        onFacesChange={editor.setFaces}
        onLoad={editor.onLoad}
        showBoxes={editor.showBoxes}
        locked={locked}
      />
      <p className="text-muted-foreground text-xs">
        The preview is drawn by the browser; the versions average each block exactly, so they can
        look a touch different. Arrow keys move a focused box (Shift for bigger steps).
      </p>
      <FaceList
        faces={editor.faces}
        selected={editor.selected}
        onSelect={editor.setSelected}
        onFacesChange={editor.setFaces}
        disabled={locked}
      />
      <PixelateActions editor={editor} saved={saved} pixelate={pixelate} locked={locked} />
    </div>
  );
}

interface ToolbarProps {
  editor: FaceEditorState;
  detect: DetectMutation;
  locked: boolean;
  onFind: () => void;
}

/** Find faces, add a box by hand, and show or hide the boxes over the preview. */
function Toolbar({ editor, detect, locked, onFind }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onFind} disabled={locked || detect.isPending}>
        {detect.isPending ? <Spinner /> : <ScanFaceIcon />}
        Find faces
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={locked || !editor.canAdd}
        onClick={editor.addBox}
      >
        <PlusIcon />
        Add a box
      </Button>
      <BoxesToggle shown={editor.showBoxes} onToggle={editor.toggleBoxes} />
    </div>
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
