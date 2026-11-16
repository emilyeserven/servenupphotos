import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { AutogroupPhoto } from "@/lib/compare-autogroup";
import { titleOf } from "@/lib/drafts";

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

interface PhotoRowProps {
  entry: AutogroupPhoto;
  /** The lines under the photo's name, such as why it's listed. */
  children: ReactNode;
  /** The Photo page section **Open the photo** opens; Details without it. */
  section?: "image";
}

/** One photo in a list: its Small version, name, the lines under it, and **Open the photo**. */
export function PhotoRow({ entry, children, section }: PhotoRowProps) {
  const title = titleOf(entry.photo.data);
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-3 p-3 text-sm sm:grid-cols-[auto_1fr_auto]">
      <img
        src={entry.imageUrl}
        alt={title ?? entry.key}
        className="bg-muted h-12 w-auto max-w-20 rounded object-contain"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <PhotoName name={entry.key} title={title} />
        {children}
      </div>
      <PhotoLink entry={entry} label="Open the photo" section={section} />
    </li>
  );
}
