import { createFileRoute, redirect } from "@tanstack/react-router";

/** A day on its own opens its first page, the photo order. */
export const Route = createFileRoute("/trip-lines/$day/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/trip-lines/$day/$part",
      params: { day: params.day, part: "order" },
      replace: true,
    });
  },
});
