import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settingsText, type Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** A photo's aperture, exposure, ISO, focal length, lens and camera, on one line. */
export function TechnicalInfo({ photo }: { photo: Photo }) {
  const parts = [...settingsText(photo.settings), photo.lens, photo.camera].filter(Boolean);
  return (
    <p className="truncate text-xs text-muted-foreground tabular-nums" title={parts.join(" · ")}>
      {parts.join(" · ")}
    </p>
  );
}

/** A button that shows or hides each photo's technical info. */
export function TechnicalInfoToggle({
  shown,
  onChange,
}: {
  shown: boolean;
  onChange: (shown: boolean) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("ml-auto", shown && "bg-accent text-accent-foreground")}
      aria-pressed={shown}
      title="Show each photo's aperture, exposure, ISO, focal length, lens and camera"
      onClick={() => onChange(!shown)}
    >
      <SlidersHorizontal aria-hidden />
      Technical info
    </Button>
  );
}
