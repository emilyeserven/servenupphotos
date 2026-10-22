import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { combinedStatusQuery } from "@/api/photos";
import { githubIsSetUp, settingsQuery } from "@/api/settings";
import { useCombinedDataStore } from "@/stores/combined-data";

/**
 * Checks once, when the app starts, whether ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the
 * photo data pull request have its latest changes. After that the combined data store knows from
 * the app's own pushes and commits, so nothing checks again. Renders nothing.
 */
export function CombinedDataSync() {
  const settings = useQuery(settingsQuery);
  return githubIsSetUp(settings.data) ? <HeadCheck /> : null;
}

function HeadCheck() {
  const { data } = useQuery(combinedStatusQuery);
  useEffect(() => {
    if (data) useCombinedDataStore.getState().headChecked(data);
  }, [data]);
  return null;
}
