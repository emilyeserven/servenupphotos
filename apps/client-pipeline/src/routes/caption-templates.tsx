import { createFileRoute } from "@tanstack/react-router";
import { CaptionTemplatesPage } from "@/components/caption-templates/page";

export const Route = createFileRoute("/caption-templates")({
  component: CaptionTemplatesPage,
});
