import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The whole map's page, which the map's Copy link button copies when the photos in view aren't all
 * in one place. The build writes it with a picture of every photo as the link preview; in the app
 * it opens the map, which fits every photo.
 */
export const Route = createFileRoute("/maps/all")({
  beforeLoad: () => {
    throw redirect({ to: "/map", replace: true });
  },
});
