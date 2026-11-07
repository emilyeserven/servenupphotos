import { createFileRoute, redirect } from "@tanstack/react-router";

/** An old Tag Data subpage, such as `/tag-data/tag-pruning`, opens that tag tool's own page. */
export const Route = createFileRoute("/tag-data/$section")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/tag-tools/$section", params, replace: true });
  },
});
