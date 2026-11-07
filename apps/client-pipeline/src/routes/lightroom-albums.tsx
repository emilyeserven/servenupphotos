import { createFileRoute } from "@tanstack/react-router";
import { LightroomAlbumsPage } from "@/components/lightroom-albums/page";

export const Route = createFileRoute("/lightroom-albums")({
  component: LightroomAlbumsPage,
});
