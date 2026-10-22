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

/** A checkbox that shows or hides each photo's technical info. */
export function TechnicalInfoToggle({
  shown,
  onChange,
}: {
  shown: boolean;
  onChange: (shown: boolean) => void;
}) {
  return (
    <label
      title="Show each photo's aperture, exposure, ISO, focal length, lens and camera"
      className="ml-auto flex cursor-pointer items-center gap-2 text-sm select-none"
    >
      <input
        type="checkbox"
        checked={shown}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
      Show Technical Info
    </label>
  );
}
