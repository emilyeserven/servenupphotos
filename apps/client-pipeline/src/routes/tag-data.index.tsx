import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/tag-data` on its own opens the first subpage, Bulk tagging. */
export const Route = createFileRoute("/tag-data/")({
  beforeLoad: () => {
    throw redirect({
      to: "/tag-data/$section",
      params: { section: "bulk-tagging" },
      replace: true,
    });
  },
});
