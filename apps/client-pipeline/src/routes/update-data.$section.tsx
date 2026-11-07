import { createFileRoute, redirect } from "@tanstack/react-router";
import { SectionCard } from "@/components/update-data/sections-layout";
import { movedSections, updateDataSections } from "@/components/update-data/sections";

export const Route = createFileRoute("/update-data/$section")({
  // Subpages that moved, such as Tag library to Tag Data, open where they are now.
  beforeLoad: ({ params }) => {
    const moved = movedSections[params.section];
    if (moved) throw redirect({ href: moved, replace: true });
  },
  component: UpdateDataSectionPage,
});

/** One Update Data subpage: its card, once GitHub is set up. */
function UpdateDataSectionPage() {
  const { section } = Route.useParams();
  return <SectionCard name="Update Data" sections={updateDataSections} slug={section} />;
}
