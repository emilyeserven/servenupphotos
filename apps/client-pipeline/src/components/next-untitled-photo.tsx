import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { type InFlightRead, photosInFlightQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import { editableUntitled, nextUntitledPath } from "@/lib/untitled-photos";

/** The in-flight photo open on the Photo page, when one is. */
function useOpenPhotoPath(): string | undefined {
  return useLocation({
    select: (location) =>
      location.pathname === "/exif" ? (location.search as { edit?: string }).edit : undefined,
  });
}

/**
 * Opens the next photo in flight without a title on the Photo page, after the one open there, so
 * untitled photos can be named one after another. Nothing when every photo in flight has a title.
 */
export function NextUntitledPhoto({ onNavigate }: { onNavigate: () => void }) {
  const inFlight = useQuery(photosInFlightQuery);
  const current = useOpenPhotoPath();
  if (!inFlight.data) return null;
  return <NextUntitledLink data={inFlight.data} current={current} onNavigate={onNavigate} />;
}

function NextUntitledLink({
  data,
  current,
  onNavigate,
}: {
  data: InFlightRead;
  current?: string;
  onNavigate: () => void;
}) {
  const next = nextUntitledPath(data, current);
  if (!next) return null;
  const count = editableUntitled(data).length;
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/exif" search={{ edit: next }} onClick={onNavigate}>
        Next untitled photo
        <span className="text-muted-foreground font-normal">{count} untitled</span>
        <ArrowRightIcon />
      </Link>
    </Button>
  );
}
