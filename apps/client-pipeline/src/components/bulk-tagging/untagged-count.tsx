import { useQuery } from "@tanstack/react-query";
import { untaggedPhotosQuery } from "@/api/bulk-tags";
import { Spinner } from "@/components/ui/spinner";

/** How many photos have no tags yet, read before anything is picked and again after each save. */
export function UntaggedCount() {
  const untagged = useQuery(untaggedPhotosQuery);
  if (untagged.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Counting the photos without tags…
      </p>
    );
  }
  if (untagged.error) {
    return <p className="text-destructive text-sm">{untagged.error.message}</p>;
  }
  return (
    <p className="text-sm">
      <span className="font-medium">{untagged.data.untagged}</span> of {untagged.data.photoFiles}{" "}
      photos have no tags yet.
    </p>
  );
}
