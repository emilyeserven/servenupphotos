import { createFileRoute, redirect } from "@tanstack/react-router";

// The Spotlight page became Albums; an old link goes there.
export const Route = createFileRoute("/spotlight")({
  beforeLoad: () => {
    throw redirect({ to: "/albums", replace: true });
  },
});
