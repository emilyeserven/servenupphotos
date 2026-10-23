import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The page's title and how many photos it shows, with the map's controls beside it on wider screens
 * and under it on phones, over the map's top left corner so the map can fill the page. It leaves
 * room on the right for the site menu, and clicks between the controls reach the map.
 */
export function MapOverlay({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute top-4 right-16 left-4 z-10 flex flex-col items-start gap-2 md:flex-row md:items-center [&>div>*]:pointer-events-auto">
      <header className="pointer-events-auto flex shrink-0 items-baseline gap-3 rounded-md border bg-background/90 px-3 py-1.5 shadow-xs backdrop-blur-sm dark:border-input">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <MapPin className="size-5 text-muted-foreground" aria-hidden />
          Map
        </h1>
        <p className="text-sm text-muted-foreground">{count} photos</p>
      </header>
      {children}
    </div>
  );
}
