import { useQuery } from "@tanstack/react-query";
import { untaggedPhotosQuery } from "@/api/bulk-tags";
import { QueryResult } from "@/components/query-result";

/** How many photos have no tags yet, read before anything is picked and again after each save. */
export function UntaggedCount() {
  const untagged = useQuery(untaggedPhotosQuery);
  return (
    <QueryResult query={untagged} pendingLabel="Reading which photos have no tags…">
      {(data) => (
        <p className="text-sm">
          <span className="font-medium">{data.untagged}</span> of {data.photoFiles} photos have no
          tags yet.
        </p>
      )}
    </QueryResult>
  );
}
