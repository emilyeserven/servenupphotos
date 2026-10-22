import { createFileRoute } from "@tanstack/react-router";
import { LocalizationsPage } from "@/components/localizations-page";

export const Route = createFileRoute("/localizations")({
  component: LocalizationsPage,
});
