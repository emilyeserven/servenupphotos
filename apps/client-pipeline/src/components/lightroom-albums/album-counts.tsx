import { Input } from "@/components/ui/input";
import type { LightroomAlbum } from "@/lib/lightroom-albums";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** A typed count as a whole number of 0 or more, or null when the box is empty. */
export function readCount(value: string): number | null {
  if (value.trim() === "") return null;
  return Math.max(0, Math.round(Number(value)));
}

interface CountBoxProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

/** A small number box with its title before it. */
function CountBox({ label, value, onChange }: CountBoxProps) {
  return (
    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
      {label}
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        className="w-20"
        value={value ?? ""}
        onChange={(event) => onChange(readCount(event.target.value))}
      />
    </label>
  );
}

/**
 * The album's photo counts to note by hand: how many it had at first, before culling, and how many it has now. The
 * count now starts as what Lightroom showed, and a new import puts in Lightroom's count again when it shows one.
 */
export function AlbumCounts({ album }: { album: LightroomAlbum }) {
  const setAlbum = useLightroomAlbumsStore((state) => state.setAlbum);
  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="group"
      aria-label={`Photos in ${album.name}`}
    >
      <CountBox
        label="Photos at first"
        value={album.originalCount}
        onChange={(originalCount) => setAlbum(album.path, { originalCount })}
      />
      <CountBox
        label="Now"
        value={album.photoCount}
        onChange={(photoCount) => setAlbum(album.path, { photoCount })}
      />
    </div>
  );
}
