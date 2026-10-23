import { createFileRoute } from "@tanstack/react-router";
import { CameraOverridesPage } from "@/components/camera-overrides/page";

export const Route = createFileRoute("/camera-overrides")({
  component: CameraOverridesPage,
});
