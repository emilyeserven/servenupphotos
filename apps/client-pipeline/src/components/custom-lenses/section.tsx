import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { type CustomLens, customLenses } from "@/api/lenses";
import type { CombinedData } from "@/api/photos";
import { LensEditor } from "@/components/custom-lenses/editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chosenLens } from "@/lib/custom-lens";
import type { CombinedPhoto } from "@/lib/group-photos";
import { shownPhotos } from "@/lib/place-seeds";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The Lenses tab's custom lenses: lenses the EXIF doesn't name well, such as manual ones, to pick on
 * the Photo page, listed on the left and the chosen one, or a new one, edited on the right.
 */
export function CustomLensesSection() {
  const { data } = useCombinedData();
  if (!data) return null;
  return (
    <section aria-label="Custom lenses" className="mt-6 flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Custom lenses</h2>
        <p className="text-muted-foreground text-sm">
          Lenses the EXIF doesn&apos;t name well, such as manual lenses adapted to the camera. Pick
          one on the Photo page and the photo gets its name as its lens, and its focal length and
          aperture, so it shows up among the lens values above. Each is one JSON file, combined into
          LENSES.json.
        </p>
      </div>
      <LensChooser data={data} />
    </section>
  );
}

/** The chosen lens's ID, or "" for a new one. */
const NEW_LENS = "";

/** The lenses listed on the left, and the chosen one, or a new one, edited on the right. */
function LensChooser({ data }: { data: CombinedData }) {
  const lenses = customLenses(data);
  const [chosen, setChosen] = useState<string>(() => lenses[0]?.id ?? NEW_LENS);
  const lens = lenses.find((l) => l.id === chosen);
  const photos = shownPhotos(data);
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <LensList lenses={lenses} photos={photos} chosen={lens?.id} onChoose={setChosen} />
      <LensEditor
        key={lens?.id ?? NEW_LENS}
        lens={lens}
        photos={photos.filter((p) => lens !== undefined && chosenLens(p) === lens.id).length}
        onSaved={setChosen}
      />
    </div>
  );
}

interface LensListProps {
  lenses: CustomLens[];
  photos: CombinedPhoto[];
  chosen?: string;
  onChoose: (id: string) => void;
}

function LensList({ lenses, photos, chosen, onChoose }: LensListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom lenses</CardTitle>
        <CardDescription>With how many photos have each.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {lenses.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {lenses.map((lens) => (
          <button
            key={lens.id}
            type="button"
            onClick={() => onChoose(lens.id)}
            aria-current={lens.id === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              lens.id === chosen && "bg-muted font-medium",
            )}
          >
            <span className="min-w-0 truncate">{lens.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {photos.filter((p) => chosenLens(p) === lens.id).length}
            </span>
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 self-start"
          disabled={chosen === undefined}
          onClick={() => onChoose(NEW_LENS)}
        >
          <PlusIcon aria-hidden />
          New lens
        </Button>
      </CardContent>
    </Card>
  );
}
