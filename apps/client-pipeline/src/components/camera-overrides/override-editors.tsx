import {
  type CameraOverride,
  deleteLensOverrideMutation,
  deleteOverrideMutation,
  type LensOverride,
  overrideId,
  saveLensOverrideMutation,
  saveOverrideMutation,
} from "@/api/cameras";
import { RulesEditor } from "@/components/camera-overrides/editor";
import type { CombinedPhoto } from "@/lib/group-photos";

interface OverrideEditorProps<T> {
  /** The camera or lens as its photos' EXIF names it. */
  name: string;
  /** Its saved override; undefined when it has none yet. */
  override?: T;
  /** The photos taken with it. */
  photos: CombinedPhoto[];
}

/** Edits one camera's override, saved to the cameras folder. */
export function CameraOverrideEditor({
  name,
  override,
  photos,
}: OverrideEditorProps<CameraOverride>) {
  return (
    <RulesEditor
      subject="camera"
      name={name}
      saved={override}
      photos={photos}
      make={(rules) => ({ id: override?.id ?? overrideId(name), camera: name, rules })}
      alone={(next) => ({ cameras: [next], lenses: [] })}
      save={saveOverrideMutation}
      remove={deleteOverrideMutation}
    />
  );
}

/** Edits one lens's override, saved to the lensoverrides folder. */
export function LensOverrideEditor({ name, override, photos }: OverrideEditorProps<LensOverride>) {
  return (
    <RulesEditor
      subject="lens"
      name={name}
      saved={override}
      photos={photos}
      make={(rules) => ({ id: override?.id ?? overrideId(name), lens: name, rules })}
      alone={(next) => ({ cameras: [], lenses: [next] })}
      save={saveLensOverrideMutation}
      remove={deleteLensOverrideMutation}
    />
  );
}
