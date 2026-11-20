import type { ComponentProps } from "react";
import { GridTiles, type ImagePhoto } from "@/components/photo-tiles";
import type { Point } from "@/lib/distance";
import { distanceBands } from "@/lib/distance-bands";
import { count } from "@/lib/words";

/**
 * The Grid's tiles sorted by Distance and grouped by nearby distances (**Group by distance**):
 * each group, such as "10 to 100 km", under its heading with its photo count, in the sort's order,
 * and the photos the map can't place last, under "No location".
 */
export function DistanceBandTiles({
  photos,
  from,
  ...tileProps
}: Omit<ComponentProps<typeof GridTiles>, "rows"> & { photos: ImagePhoto[]; from: Point }) {
  return (
    <div className="flex flex-col gap-10">
      {distanceBands(photos, from).map((band) => (
        <section key={band.label} aria-label={band.label} className="flex flex-col gap-3">
          <h2 className="mx-auto flex w-full max-w-6xl items-baseline gap-3 px-1 sm:px-2">
            <span className="text-xl font-semibold tracking-tight">{band.label}</span>
            <span className="text-sm text-muted-foreground">
              {count(band.photos.length, "photo")}
            </span>
          </h2>
          <GridTiles {...tileProps} photos={band.photos} />
        </section>
      ))}
    </div>
  );
}
