import { useMemo, useState } from "react";
import { ReadProblems } from "@/components/compare/compare-group-list";
import { PhotoScopeToggle } from "@/components/photo-scope-toggle";
import { AspectRatioCheck } from "@/components/quality-check/aspect-ratio-check";
import { MissingPlacesCheck } from "@/components/quality-check/missing-places-check";
import { PixelationCheck } from "@/components/quality-check/pixelation-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompareGroups } from "@/hooks/use-compare-groups";
import { type AutogroupScope, autogroupPhotos } from "@/lib/compare-autogroup";

/**
 * Quality Check: checks every photo, or only the drafts, for what should be fixed before it's
 * posted: crops that aren't the house aspect ratios, license plates or faces to pixelate, and
 * photos without a place. A crop or pixelation failure can be flagged for re-edit with a
 * photographer note saying what failed.
 */
export function QualityCheckCard() {
  const compare = useCompareGroups();
  const [scope, setScope] = useState<AutogroupScope>("all");
  const photos = useMemo(
    () => autogroupPhotos(compare.photos, { scope, skipGrouped: false }),
    [compare.photos, scope],
  );
  const every = useMemo(
    () => autogroupPhotos(compare.photos, { scope: "all", skipGrouped: false }),
    [compare.photos],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quality Check</CardTitle>
        <CardDescription>
          Checks the chosen photos for crops that aren&apos;t the house aspect ratios, for license
          plates or faces that need pixelating, and for photos without a place. Crops and pixelation
          that fail can be flagged for re-edit, with a photographer note saying what failed, waiting
          for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ReadProblems problems={compare.problems} />
        <PhotoScopeToggle label="Which photos to check" value={scope} onChange={setScope} />
        {compare.pending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <>
            <AspectRatioCheck key={`aspect-${scope}`} photos={photos} />
            <Separator />
            <PixelationCheck key={`pixelation-${scope}`} photos={photos} every={every} />
            <Separator />
            <MissingPlacesCheck photos={photos} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
