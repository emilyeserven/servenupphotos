import { createFileRoute } from "@tanstack/react-router";
import { SmallTagsPage } from "@/components/small-tags/page";

export const Route = createFileRoute("/small-tags")({
  component: SmallTagsPage,
});
