import { createFileRoute, redirect } from "@tanstack/react-router";

// The Trips were briefly a page of their own; a link to it opens the Trip Lines page's Trips tab.
export const Route = createFileRoute("/trips")({
  beforeLoad: () => {
    throw redirect({ to: "/trip-lines", search: { tab: "trips" }, replace: true });
  },
});
