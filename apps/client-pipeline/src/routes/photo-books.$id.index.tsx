import { createFileRoute, redirect } from "@tanstack/react-router";

/** A book on its own opens its Pages tab. */
export const Route = createFileRoute("/photo-books/$id/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/photo-books/$id/$part",
      params: { id: params.id, part: "pages" },
      replace: true,
    });
  },
});
