import { HandIcon, ScanIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import type { PreviewZoom } from "@/components/face-pixelation/use-preview-zoom";
import { Button } from "@/components/ui/button";

/** Zooms the preview in and out, back to fitting, and turns dragging to move around on and off. */
export function ZoomControls({ zoom }: { zoom: PreviewZoom }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={!zoom.canZoomOut}
        onClick={zoom.zoomOut}
      >
        <ZoomOutIcon />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">
        {Math.round(zoom.zoom * 100)}%
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={!zoom.canZoomIn}
        onClick={zoom.zoomIn}
      >
        <ZoomInIcon />
      </Button>
      <Button variant="ghost" size="sm" disabled={zoom.zoom === 1} onClick={zoom.fit}>
        <ScanIcon />
        Fit
      </Button>
      <Button
        variant={zoom.moving ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={zoom.moving}
        disabled={zoom.zoom === 1}
        onClick={zoom.toggleMoving}
      >
        <HandIcon />
        Move around
      </Button>
    </div>
  );
}
