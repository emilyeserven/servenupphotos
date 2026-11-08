import { useQuery } from "@tanstack/react-query";
import { combinedStatusQuery } from "@/api/photos";
import { useCombinedData, useCombinedDataStore } from "@/stores/combined-data";

/**
 * The combined lists with every change made this session, for pages that start an editor from
 * them, such as Trip Lines: pending until the changes waiting for Commit that the backend kept
 * (from before a reload) are made over the lists too, so an editor never starts from the committed
 * files and then misses them. If that check fails, the lists show with the changes this browser
 * knows of.
 */
export function useSessionData() {
  const combined = useCombinedData();
  const status = useQuery(combinedStatusQuery);
  const seeded = useCombinedDataStore((s) => s.headState !== undefined);
  return { ...combined, isPending: combined.isPending || (!seeded && !status.isError) };
}
