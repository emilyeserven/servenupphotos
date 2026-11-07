import { createFileRoute } from "@tanstack/react-router";
import { SectionsLayout } from "@/components/update-data/sections-layout";
import { tagDataSections } from "@/components/update-data/sections";

export const Route = createFileRoute("/tag-data")({
  component: TagDataPage,
  staticData: { wide: true },
});

/** Bulk changes to the photos' tags and the tag files, one subpage each, under Tags in the sidebar. */
function TagDataPage() {
  return (
    <SectionsLayout
      name="Tag Data"
      description="Bulk changes to the photos' tags and the tag files. Each one previews what it will change, then saves it waiting for Commit."
      sections={tagDataSections}
      to="/tag-data/$section"
    />
  );
}
