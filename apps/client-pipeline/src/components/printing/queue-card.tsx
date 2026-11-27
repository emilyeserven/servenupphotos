import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { QueueItem } from "@/components/printing/queue-item";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CombinedPhoto } from "@/lib/group-photos";
import type { BookAlbum } from "@/lib/photo-book-album";
import { photoKey } from "@/lib/print-queue";
import { printPicks } from "@/stores/printing";
import { EmptyNote } from "@portfolio/components/empty-note";
import { CONTROL_FRAME, controlButtonClass } from "@portfolio/lib/segmented-control";
import { count } from "@portfolio/lib/words";

/** Which of the queue's photos are shown: all of them, or only the hearted ones. */
type Shown = "all" | "hearted";

/**
 * The print queue album's photos, each with its print rating and a heart to pick it as one to
 * actually print, with how many are hearted and a switch to show only those.
 */
export function QueueCard({ album, photos }: { album: BookAlbum; photos: CombinedPhoto[] }) {
  const picks = printPicks.use();
  const [shown, setShown] = useState<Shown>("all");
  const hearted = photos.filter((photo) => picks.includes(photoKey(photo)));
  const list = shown === "hearted" ? hearted : photos;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{album.name || album.id}</CardTitle>
        <CardDescription>
          {count(photos.length, "photo")} in the queue, {hearted.length} hearted to print.{" "}
          <Link
            to="/albums/$id"
            params={{ id: album.id }}
            className="text-foreground underline underline-offset-4"
          >
            Open the album
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ShownSwitch shown={shown} onChange={setShown} />
        <QueueList photos={list} shown={shown} />
      </CardContent>
    </Card>
  );
}

const SHOWN: { value: Shown; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hearted", label: "Hearted" },
];

function ShownSwitch({ shown, onChange }: { shown: Shown; onChange: (shown: Shown) => void }) {
  return (
    <div className={`${CONTROL_FRAME} self-start`} role="group" aria-label="Photos shown">
      {SHOWN.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={shown === option.value}
          className={controlButtonClass(shown === option.value)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function QueueList({ photos, shown }: { photos: CombinedPhoto[]; shown: Shown }) {
  if (photos.length === 0) {
    return (
      <EmptyNote>
        {shown === "hearted"
          ? "No photos hearted yet. Press a photo's heart to pick it to print."
          : "No photos in this album yet. Add some from the Gallery or the album's page."}
      </EmptyNote>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
      {photos.map((photo) => (
        <QueueItem key={photoKey(photo)} photo={photo} />
      ))}
    </ul>
  );
}
