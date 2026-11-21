import { createFileRoute } from "@tanstack/react-router";
import { LightroomImportPage } from "@/components/lightroom-albums/import-page";
import { fixedCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/lightroom-albums/import")({
  component: LightroomImportPage,
  staticData: { crumbs: fixedCrumbs("Import") },
});
