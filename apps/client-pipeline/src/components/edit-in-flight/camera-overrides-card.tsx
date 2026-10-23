import { Link } from "@tanstack/react-router";
import { cameraOverrides } from "@/api/cameras";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exifCamera, overrideChanges } from "@/lib/camera-overrides";
import type { CombinedPhoto } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

interface CameraOverridesCardProps {
  /** The photo's JSON as last saved. */
  saved: CombinedPhoto;
  /** The fields the overrides change, once applied to the edit; null until they are. */
  applied: Record<string, unknown> | null;
  onApply: (fields: Record<string, unknown> | null) => void;
  disabled: boolean;
}

/**
 * What the camera overrides for the photo's camera would change in its JSON, as they stand now,
 * with a button putting those changes into the edit for Save changes to write.
 */
export function CameraOverridesCard({
  saved,
  applied,
  onApply,
  disabled,
}: CameraOverridesCardProps) {
  const combined = useCombinedData();
  const changes = overrideChanges(cameraOverrides(combined.data), saved);
  const fields = Object.entries(changes);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera overrides</CardTitle>
        <CardDescription>
          <Status camera={exifCamera(saved)} changes={fields.length} />{" "}
          <Link to="/camera-overrides" className="text-foreground underline underline-offset-4">
            Camera Overrides
          </Link>{" "}
          sets them for each camera.
        </CardDescription>
      </CardHeader>
      {fields.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {fields.map(([field, to]) => (
              <div key={field} className="contents">
                <dt className="font-medium">{field}</dt>
                <dd className="font-mono text-xs break-all">
                  {JSON.stringify(saved[field] ?? null)} → {JSON.stringify(to)}
                </dd>
              </div>
            ))}
          </dl>
          <ApplyButton
            applied={applied !== null}
            disabled={disabled}
            onClick={() => onApply(applied ? null : changes)}
          />
        </CardContent>
      )}
    </Card>
  );
}

/** Whether the overrides for camera change anything in the photo. */
function Status({ camera, changes }: { camera: string; changes: number }) {
  if (!camera) return <>Its EXIF names no camera, so no override is for it.</>;
  if (changes === 0) return <>The photo already has the overrides for {camera}, if it has any.</>;
  return <>The overrides for {camera} change these fields from what the JSON has.</>;
}

function ApplyButton({
  applied,
  disabled,
  onClick,
}: {
  applied: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant={applied ? "outline" : "default"} disabled={disabled} onClick={onClick}>
        {applied ? "Don't apply" : "Apply overrides"}
      </Button>
      {applied && <span className="text-muted-foreground text-sm">Save changes writes them.</span>}
    </div>
  );
}
