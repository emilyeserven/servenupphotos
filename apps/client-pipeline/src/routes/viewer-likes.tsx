import { createFileRoute } from "@tanstack/react-router";
import { ViewerLikesPage } from "@/components/viewer-likes/page";

export const Route = createFileRoute("/viewer-likes")({
  component: ViewerLikesPage,
});
