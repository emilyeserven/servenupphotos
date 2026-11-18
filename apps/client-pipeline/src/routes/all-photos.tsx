import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseShowSearch } from "@/lib/gallery-show";

/**
 * All Photos is part of the Gallery now: an old `/all-photos` link opens the Gallery with the same
 * Show group, photo and sort, since both pages name them the same way.
 */
export const Route = createFileRoute("/all-photos")({
  validateSearch: parseShowSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/gallery", search, replace: true });
  },
});
