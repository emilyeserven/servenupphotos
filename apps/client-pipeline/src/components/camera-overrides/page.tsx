import { useState } from "react";
import { cameraOverrides } from "@/api/cameras";
import type { CombinedData } from "@/api/photos";
import { OverrideEditor } from "@/components/camera-overrides/editor";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type CameraRow, cameraPhotos, cameraRows } from "@/lib/camera-overrides";
import type { CombinedPhoto } from "@/lib/group-photos";
import { shownPhotos } from "@/lib/place-seeds";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** The Camera Overrides page: what to write instead of each camera's EXIF values. */
export function CameraOverridesPage() {
  return (
    <Page
      wide
      title="Camera Overrides"
      description="What to write instead of a camera's EXIF values, such as “Fujifilm X-T5” for “X-T5”, or a lens's name for “21.0 mm”. Each camera's rules are one JSON file, combined into CAMERAS.json. New photos get them when their EXIF is read; Update Data and the Photo page apply them to photos already saved."
    >
      <GitHubGate>{() => <Cameras />}</GitHubGate>
    </Page>
  );
}

function Cameras() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and camera overrides from GitHub…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <CameraChooser data={combined.data} />;
}

/** The cameras listed on the left, and the chosen one's override edited on the right. */
function CameraChooser({ data }: { data: CombinedData }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const photos = shownPhotos(data);
  const rows = cameraRows(photos, cameraOverrides(data));
  const row = rows.find((r) => r.camera === chosen) ?? rows[0];
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
      <CameraList rows={rows} chosen={row?.camera} onChoose={setChosen} />
      <ChosenCamera row={row} photos={photos} />
    </div>
  );
}

/** The editor for the chosen camera, keyed by it so each starts from its saved rules. */
function ChosenCamera({ row, photos }: { row?: CameraRow; photos: CombinedPhoto[] }) {
  if (!row) {
    return <p className="text-muted-foreground text-sm">No photo has a camera in its EXIF yet.</p>;
  }
  return (
    <OverrideEditor
      key={`${row.camera}\u0000${row.override?.id ?? ""}`}
      camera={row.camera}
      override={row.override}
      photos={cameraPhotos(photos, row.camera)}
    />
  );
}

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

interface CameraListProps {
  rows: CameraRow[];
  chosen?: string;
  onChoose: (camera: string) => void;
}

function CameraList({ rows, chosen, onChoose }: CameraListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cameras</CardTitle>
        <CardDescription>As the photos&apos; EXIF names them.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {rows.map((row) => (
          <button
            key={row.camera}
            type="button"
            onClick={() => onChoose(row.camera)}
            aria-current={row.camera === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              row.camera === chosen && "bg-muted font-medium",
            )}
          >
            <span className="min-w-0 truncate">{row.camera}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {plural(row.photos, "photo")}
              <RuleCount row={row} />
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function RuleCount({ row }: { row: CameraRow }) {
  if (!row.override) return null;
  return <span className="text-foreground">, {plural(row.override.rules.length, "rule")}</span>;
}
