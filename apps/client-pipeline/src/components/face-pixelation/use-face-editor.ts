import { useCallback, useState } from "react";
import type { Size } from "@/lib/crop";
import { type FaceBox, MAX_FACES, middleBox, newFaces, sameBoxes } from "@/lib/face-boxes";

/** The faces being edited against the saved ones, which one is picked, and how to change them. */
export function useFaceEditor(saved: FaceBox[]) {
  const [faces, setAllFaces] = useState<FaceBox[]>(saved);
  const [selected, setSelected] = useState<number | null>(saved.length > 0 ? 0 : null);
  const [photo, setPhoto] = useState<Size | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const setFaces = (next: FaceBox[]) => setAllFaces(next.slice(0, MAX_FACES));
  /** Adds boxes after the others and picks the first of them, when there are any. */
  const append = (added: FaceBox[]) => {
    setFaces([...faces, ...added]);
    if (added.length > 0) setSelected(faces.length);
  };
  const replace = (next: FaceBox[]) => {
    setAllFaces(next);
    setSelected(null);
  };
  return {
    faces,
    setFaces,
    selected,
    setSelected,
    /** The photo's size, once the preview has loaded it. */
    photo,
    onLoad: useCallback((size: Size) => setPhoto(size), []),
    showBoxes,
    toggleBoxes: () => setShowBoxes((shown) => !shown),
    /** Whether the faces differ from the saved ones. */
    changed: !sameBoxes(faces, saved),
    /** Whether another box can be added by hand. */
    canAdd: photo !== null && faces.length < MAX_FACES,
    addBox: () => photo && append([middleBox(photo)]),
    /** Adds an area to keep as it is, such as hair over a face, in the middle of the photo. */
    addKeep: () => photo && append([{ ...middleBox(photo), keep: true }]),
    /** Adds the found faces that aren't boxed yet. */
    addFound: (found: FaceBox[]) => append(newFaces(faces, found)),
    reset: () => replace(saved),
    clear: () => replace([]),
  };
}

/** The faces being edited, from `useFaceEditor`. */
export type FaceEditorState = ReturnType<typeof useFaceEditor>;
