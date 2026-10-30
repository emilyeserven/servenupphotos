import { LayoutPhotoList } from "@/components/album-layout/layout-photo";
import { PhotoPickDialog } from "@/components/album-layout/photo-pick-dialog";
import { photoId } from "@/lib/album-photo-order";
import { MAX_COVERS } from "@/lib/album-layout";
import type { CombinedPhoto } from "@/lib/group-photos";

interface CoverPickerProps {
  covers: number[];
  /** The album's photos, in its order. */
  photos: CombinedPhoto[];
  byId: ReadonlyMap<number, CombinedPhoto>;
  onChange: (covers: number[]) => void;
}

/**
 * Up to 5 cover photos, in order, that stand for the album on the portfolio's Albums page in place
 * of its first 5, with a button to pick more from the album's photos.
 */
export function CoverPicker({ covers, photos, byId, onChange }: CoverPickerProps) {
  const left = MAX_COVERS - covers.length;
  const choices = photos.filter((photo) => !covers.includes(photoId(photo) ?? 0));
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">
          Covers ({covers.length} of {MAX_COVERS})
        </h3>
        <p className="text-muted-foreground text-xs">
          The portfolio's Albums page shows these for the album, in this order.{" "}
          {covers.length === 0 && "With none, it shows the album's first 5 photos."}
        </p>
      </div>
      <ul className="flex flex-wrap items-center gap-2">
        <LayoutPhotoList ids={covers} photos={byId} onChange={onChange} />
        <li>
          <PhotoPickDialog
            label={covers.length === 0 ? "Choose covers" : "Add covers"}
            title="Cover photos"
            description={`Pick up to ${left} more, in the order the Albums page should show them.`}
            choices={choices}
            max={left}
            onPick={(ids) => onChange([...covers, ...ids])}
          />
        </li>
      </ul>
    </section>
  );
}
