import { createFileRoute } from "@tanstack/react-router";
import { fixedCrumbs } from "@/components/sidebar/route-crumbs";
import { LightroomImportPage } from "@/components/lightroom-albums/import-page";

export const Route = createFileRoute("/lightroom-albums/import")({
  component: LightroomImportPage,
  staticData: { crumbs: fixedCrumbs("Import") },
});
