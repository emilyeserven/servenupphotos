import { createFileRoute } from "@tanstack/react-router";
import { SectionCard } from "@/components/update-data/sections-layout";
import { tagDataSections } from "@/components/update-data/sections";

export const Route = createFileRoute("/tag-data/$section")({
  component: TagDataSectionPage,
});

/** One Tag Data subpage: its card, once GitHub is set up. */
function TagDataSectionPage() {
  const { section } = Route.useParams();
  return <SectionCard name="Tag Data" sections={tagDataSections} slug={section} />;
}
