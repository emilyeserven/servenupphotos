import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { keepWork } from "@/lib/in-flight-work";
import { useCombinedDataStore } from "@/stores/combined-data";
import { useInFlightBackupStore } from "@/stores/in-flight-backup";
import { useLocalEditsStore } from "@/stores/local-edits";

/** Notes when the browser goes offline, so the in-flight work starts being kept in it. */
function useOfflineEvents() {
  useEffect(() => {
    const mark = () => useInFlightBackupStore.getState().markOffline();
    if (!navigator.onLine) mark();
    window.addEventListener("offline", mark);
    return () => window.removeEventListener("offline", mark);
  }, []);
}

/**
 * While the pipeline is or was offline, copies the in-flight work to localStorage when the app
 * starts, after every save and edit, and after a Commit, which drops the copy once nothing is left
 * waiting. Renders nothing.
 */
export function InFlightBackupKeeper() {
  const queryClient = useQueryClient();
  const offlineSeen = useInFlightBackupStore((s) => s.offlineSeen);
  useOfflineEvents();
  useEffect(() => {
    if (!offlineSeen) return;
    void keepWork();
    const saves = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") void keepWork();
    });
    const edits = useLocalEditsStore.subscribe(() => void keepWork());
    const commits = useCombinedDataStore.subscribe((state, before) => {
      if (state.lastCommit !== before.lastCommit) void keepWork(true);
    });
    return () => {
      saves();
      edits();
      commits();
    };
  }, [offlineSeen, queryClient]);
  return null;
}
