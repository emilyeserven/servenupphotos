import { useEffect, useRef } from "react";
import { useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { useCombinedDataStore } from "@/stores/combined-data";

/**
 * Follows CI's "Combine photo data" run after each push to the photo data pull request, wherever
 * it came from, and has the combined data store read ALLPHOTOS.json, ALLALBUMS.json and
 * ALLTAGS.json again once the run has rebuilt them. Renders nothing.
 */
export function CombinedDataSync() {
  const awaitingRebuild = useCombinedDataStore((s) => s.awaitingRebuild);
  const pushes = useCombinedDataStore((s) => s.pushes);
  const rebuild = useAllPhotosRebuild(awaitingRebuild, () => {
    if (useCombinedDataStore.getState().awaitingRebuild) useCombinedDataStore.getState().rebuilt();
  });
  const afterPush = useRef(rebuild.afterPush);
  useEffect(() => {
    afterPush.current = rebuild.afterPush;
  });
  useEffect(() => {
    if (pushes > 0) afterPush.current();
  }, [pushes]);
  return null;
}
