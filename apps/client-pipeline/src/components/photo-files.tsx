import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useCallback } from "react";
import { type SocialCalendar, type SocialCalendarRead, socialCalendarQuery } from "@/api/publish";
import { QueryResult } from "@/components/query-result";
import { withBaseAllPhotos } from "@/lib/combined";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Reads every photo file, as the Publish pages pick from them, and shows children with them once
 * they're read. ALLPHOTOS.json on the base branch, kept by the combined data store, tells photos in
 * flight from published ones.
 */
export function PhotoFiles({ children }: { children: (files: SocialCalendar) => ReactNode }) {
  const combined = useCombinedData();
  const { data: lists, error } = combined;
  const select = useCallback(
    (read: SocialCalendarRead) => withBaseAllPhotos(read, { data: lists, error }),
    [lists, error],
  );
  const files = useQuery({ ...socialCalendarQuery, select });
  if (combined.isPending) return <p>Reading ALLPHOTOS.json…</p>;
  return (
    <QueryResult query={files} pendingLabel="Reading the photo JSON…">
      {children}
    </QueryResult>
  );
}
