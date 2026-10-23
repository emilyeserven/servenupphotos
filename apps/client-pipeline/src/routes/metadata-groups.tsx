import { createFileRoute } from "@tanstack/react-router";
import { MetadataGroupsPage } from "@/components/metadata-groups-page";

export const Route = createFileRoute("/metadata-groups")({
  component: MetadataGroupsPage,
});
