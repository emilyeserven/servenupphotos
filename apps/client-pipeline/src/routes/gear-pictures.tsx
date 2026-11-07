import { createFileRoute } from "@tanstack/react-router";
import { GearPicturesPage } from "@/components/gear-pictures/page";

export const Route = createFileRoute("/gear-pictures")({
  component: GearPicturesPage,
});
