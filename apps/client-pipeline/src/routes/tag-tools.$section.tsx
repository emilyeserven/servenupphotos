import { createFileRoute } from "@tanstack/react-router";
import { TagToolPage } from "@/components/tag-tool-page";

export const Route = createFileRoute("/tag-tools/$section")({
  component: TagToolRoute,
});

/** One tag tool, such as Bulk tagging, listed under Tools in the Tags submenu. */
function TagToolRoute() {
  const { section } = Route.useParams();
  return <TagToolPage slug={section} />;
}
