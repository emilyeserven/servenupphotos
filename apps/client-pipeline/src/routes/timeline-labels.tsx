import { createFileRoute, redirect } from "@tanstack/react-router";

// Timeline labels became Trips, so a link to the old page opens the Trip Lines page's Trips tab.
export const Route = createFileRoute("/timeline-labels")({
  beforeLoad: () => {
    throw redirect({ to: "/trip-lines", search: { tab: "trips" }, replace: true });
  },
});
