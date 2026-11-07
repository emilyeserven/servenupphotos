import { createFileRoute, redirect } from "@tanstack/react-router";

/** The old Tag Data page, `/tag-data`, opens Bulk tagging, the first of the tag tools. */
export const Route = createFileRoute("/tag-data/")({
  beforeLoad: () => {
    throw redirect({
      to: "/tag-tools/$section",
      params: { section: "bulk-tagging" },
      replace: true,
    });
  },
});
