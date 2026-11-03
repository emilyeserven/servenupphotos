import { createFileRoute } from "@tanstack/react-router";
import { FanLikesPage } from "@/components/fan-likes/page";

export const Route = createFileRoute("/fan-likes")({
  component: FanLikesPage,
});
