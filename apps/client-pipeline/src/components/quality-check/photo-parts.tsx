import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutogroupPhoto } from "@/lib/compare-autogroup";

/** The photo's title and file name, or its file name alone when it has no title. */
export function PhotoName({ name, title }: { name: string; title: string | undefined }) {
  if (!title) return <p className="font-medium break-words">{name}</p>;
  return (
    <p className="font-medium break-words">
      {title}
      <span className="text-muted-foreground font-normal"> · {name}</span>
    </p>
  );
}

interface PhotoLinkProps {
  entry: AutogroupPhoto;
  label: string;
  /** The Photo page section to open, such as `image` where faces are pixelated; Details without it. */
  section?: "image";
}

/** Opens the photo on the Photo page, at `section`, as the Gallery or Photos in Flight would. */
export function PhotoLink({ entry, label, section }: PhotoLinkProps) {
  const { photo } = entry;
  const search = {
    edit: photo.file.path,
    ...(photo.fromGallery ? { from: "gallery" as const } : {}),
    ...(section ? { section } : {}),
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="col-start-2 justify-self-start sm:col-start-auto"
      asChild
    >
      <Link to="/exif" search={search}>
        <ExternalLinkIcon />
        {label}
      </Link>
    </Button>
  );
}
