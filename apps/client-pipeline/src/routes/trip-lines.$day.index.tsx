import { createFileRoute, redirect } from "@tanstack/react-router";

/** A day on its own opens its first page, the Route. */
export const Route = createFileRoute("/trip-lines/$day/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/trip-lines/$day/$part",
      params: { day: params.day, part: "route" },
      replace: true,
    });
  },
});
