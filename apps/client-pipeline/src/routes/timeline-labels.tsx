import { createFileRoute, redirect } from "@tanstack/react-router";

// Timeline labels became Trips, so a link to the old page opens the Trips page.
export const Route = createFileRoute("/timeline-labels")({
  beforeLoad: () => {
    throw redirect({ to: "/trips", replace: true });
  },
});
