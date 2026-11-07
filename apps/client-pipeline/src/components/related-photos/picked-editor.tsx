import { useMutation } from "@tanstack/react-query";
import { SaveIcon } from "lucide-react";
import { useState } from "react";
import { setPickedSimilarMutation } from "@/api/related-photos";
import { ErrorText } from "@/components/bulk-tagging/pick-controls";
import type { SavedPhoto } from "@/components/saved-photo-picker";
import { PickedSimilarFields } from "@/components/related-photos/picked-similar-fields";
import {
  foundIds,
  type Pick,
  pickFields,
  picksChanged,
  savedPhotoId,
  savedPicks,
} from "@/components/related-photos/picks";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface PickedEditorProps {
  photo: SavedPhoto;
  /** Every saved photo with an ID. */
  photos: readonly SavedPhoto[];
  byId: ReadonlyMap<number, SavedPhoto>;
}

/** The Related Photos page's picks for one photo, with Save picks, which saves only them. */
export function PickedEditor({ photo, photos, byId }: PickedEditorProps) {
  const [picks, setPicks] = useState(() => savedPicks(photo.file.data));
  return (
    <PickedSimilarFields
      self={savedPhotoId(photo)}
      found={foundIds(photo.file.data)}
      picks={picks}
      onChange={setPicks}
      photos={photos}
      byId={byId}
    >
      <SavePicks photo={photo} picks={picks} />
    </PickedSimilarFields>
  );
}
/** Save, enabled once the picks differ from the photo's saved ones, and what came of it. */
function SavePicks({ photo, picks }: { photo: SavedPhoto; picks: Pick[] }) {
  const save = useMutation(setPickedSimilarMutation);
  const changed = picksChanged(savedPicks(photo.file.data), picks);
  return (
    <>
      <div className="flex items-center gap-3">
        <SaveButton
          pending={save.isPending}
          disabled={!changed}
          onClick={() => save.mutate({ path: photo.path, ...pickFields(picks) })}
        />
        {save.isSuccess && !changed && (
          <span className="text-muted-foreground text-sm">Saved, waiting for Commit.</span>
        )}
      </div>
      <ErrorText error={save.error} />
    </>
  );
}

/** Save picks, with a spinner while saving. */
function SaveButton({
  pending,
  disabled,
  onClick,
}: {
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button size="sm" disabled={disabled || pending} onClick={onClick}>
      {pending ? <Spinner /> : <SaveIcon aria-hidden />}
      Save picks
    </Button>
  );
}
