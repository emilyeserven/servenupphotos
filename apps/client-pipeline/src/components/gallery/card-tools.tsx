import { CircleHelpIcon } from "lucide-react";
import { CompareButton } from "@/components/compare/compare-button";
import type { GalleryFile } from "@/components/gallery/gallery-files";
import { selectProblem } from "@/components/gallery/published-file";
import { IconToolButton, IconToolGroup } from "@/components/icon-tool-button";
import { ReEditButton } from "@/components/in-flight-page/re-edit-button";
import { useSetUndecided } from "@/components/undecided-photos";

/**
 * A Gallery tile's button group, icons only with their names on hover: Compare, to put the photo in
 * a compare group, Undecided, to set it aside or move it back, and Re-edit, Photos in Flight's form
 * to mark it for editing again with a note, or take the mark off. Each is a change waiting for
 * Commit, and none shows for a photo whose JSON couldn't be read or that's removed.
 */
export function CardTools({ file }: { file: GalleryFile }) {
  const changeable = !selectProblem(file);
  return (
    <IconToolGroup label="Photo actions">
      <CompareButton file={file} iconOnly />
      {changeable && <UndecidedTool file={file} />}
      <ReEditButton file={file} iconOnly />
    </IconToolGroup>
  );
}

/** Sends the photo to Undecided, or moves it back once it's there. */
function UndecidedTool({ file }: { file: GalleryFile }) {
  const setUndecided = useSetUndecided();
  const undecided = file.kind === "undecided";
  return (
    <IconToolButton
      label={undecided ? "Undecided: move back" : "Undecided"}
      pressed={undecided}
      icon={<CircleHelpIcon />}
      onClick={() => setUndecided([file], !undecided)}
    />
  );
}
