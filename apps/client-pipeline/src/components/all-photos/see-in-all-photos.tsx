import { Link } from "@tanstack/react-router";
import { LocateFixedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeeInAllPhotosProps {
  path: string;
  /** Whether it's set aside as Undecided rather than a draft without a title. */
  undecided?: boolean;
}

/** What the link says when hovered. */
const HINT = "See it among the other photos on All Photos";

/** The All Photos page's search for the photo: it scrolled to, with its kind shown. */
function searchFor({ path, undecided }: SeeInAllPhotosProps) {
  return undecided
    ? { photo: path, undecided: true as const }
    : { photo: path, drafts: true as const };
}

/**
 * A link, as an icon, to a draft or Undecided photo's place on the All Photos page, with its kind
 * shown, so it can be seen among the published photos around it.
 */
export function SeeInAllPhotos(props: SeeInAllPhotosProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground size-8"
      title={HINT}
      aria-label="See in All Photos"
      asChild
    >
      <Link to="/all-photos" search={searchFor(props)}>
        <LocateFixedIcon />
      </Link>
    </Button>
  );
}
