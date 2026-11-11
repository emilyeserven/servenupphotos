import { useCallback, useState } from "react";
import type { VisibleArea } from "@/components/face-pixelation/face-preview";
import type { Size } from "@/lib/crop";
import { type FaceBox, MAX_FACES, middleBox, newArea, newFaces, sameBoxes } from "@/lib/face-boxes";

/**
 * The faces being edited against the saved ones, which one is picked, and how to change them. They
 * start as initial, the saved ones unless another start is given.
 */
export function useFaceEditor(saved: FaceBox[], initial: FaceBox[] = saved) {
  const [faces, setAllFaces] = useState<FaceBox[]>(initial);
  const [selected, setSelected] = useState<number | null>(initial.length > 0 ? 0 : null);
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
    /**
     * Adds a box to pixelate, or with `keep` an area to keep as it is (such as hair over a face),
     * in the middle of the part of the photo in view, the whole photo unless zoomed in.
     */
    add: (keep: boolean, visible?: VisibleArea) =>
      photo && append([addedArea(photo, keep, visible)]),
    /** Adds the found faces that aren't boxed yet, as circles with whole-block edges. */
    addFound: (found: FaceBox[]) => append(newFaces(faces, found).map(newArea)),
    /** Adds the areas that aren't boxed yet as they are, keeping their shapes and densities. */
    addAreas: (areas: FaceBox[]) => append(newFaces(faces, areas)),
    reset: () => replace(saved),
    clear: () => replace([]),
  };
}

/** A new box in the middle of the part of the photo in view, kept as it is with `keep`. */
function addedArea(photo: Size, keep: boolean, visible: VisibleArea | undefined): FaceBox {
  const box = middleBox(photo, visible?.center, visible?.view);
  return keep ? { ...box, keep } : box;
}

/** The faces being edited, from `useFaceEditor`. */
export type FaceEditorState = ReturnType<typeof useFaceEditor>;
