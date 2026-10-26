import { settingsText, type Photo } from "@/lib/photos";

/** A photo's aperture, exposure, ISO, focal length, lens and camera, on one line. */
export function TechnicalInfo({ photo }: { photo: Photo }) {
  const parts = [...settingsText(photo.settings), photo.lens, photo.camera].filter(Boolean);
  return (
    <p
      className="my-1 max-w-full self-start truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground tabular-nums"
      title={parts.join(" · ")}
    >
      {parts.join(" · ")}
    </p>
  );
}
