import { createFileRoute } from "@tanstack/react-router";
import { LightroomImportPage } from "@/components/lightroom-albums/import-page";

export const Route = createFileRoute("/lightroom-albums/import")({
  component: LightroomImportPage,
  staticData: { subpage: "Import" },
});
