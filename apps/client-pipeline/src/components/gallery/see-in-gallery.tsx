import { Link } from "@tanstack/react-router";
import { LocateFixedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeeInGalleryProps {
  path: string;
  /** Whether it's set aside as Undecided rather than a draft without a title. */
  undecided?: boolean;
}

/** What the link says when hovered. */
const HINT = "See it among the other photos on the Gallery";

/** The Gallery's search for the photo: it scrolled to, with its Show group on. */
function searchFor({ path, undecided }: SeeInGalleryProps) {
  return undecided
    ? { photo: path, undecided: true as const }
    : { photo: path, drafts: true as const };
}

/**
 * A link, as an icon, to a draft or Undecided photo's place on the Gallery, with its Show group
 * on, so it can be seen among the published photos around it.
 */
export function SeeInGallery(props: SeeInGalleryProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground size-8"
      title={HINT}
      aria-label="See in Gallery"
      asChild
    >
      <Link to="/gallery" search={searchFor(props)}>
        <LocateFixedIcon />
      </Link>
    </Button>
  );
}
