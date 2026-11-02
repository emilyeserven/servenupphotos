import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/update-data` on its own opens the first subpage, Image base URL. */
export const Route = createFileRoute("/update-data/")({
  beforeLoad: () => {
    throw redirect({
      to: "/update-data/$section",
      params: { section: "image-base-url" },
      replace: true,
    });
  },
});
