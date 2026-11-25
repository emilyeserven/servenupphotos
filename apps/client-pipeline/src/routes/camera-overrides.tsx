import { createFileRoute } from "@tanstack/react-router";
import { CameraOverridesPage } from "@/components/camera-overrides/page";

/** The Camera Overrides page's search: `tab`, the Lenses tab when it's "lenses". */
interface CameraOverridesSearch {
  tab?: "lenses";
}

export const Route = createFileRoute("/camera-overrides")({
  validateSearch: (search: Record<string, unknown>): CameraOverridesSearch =>
    search.tab === "lenses" ? { tab: "lenses" } : {},
  component: CameraOverridesPage,
});
