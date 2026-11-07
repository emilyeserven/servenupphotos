import { createFileRoute } from "@tanstack/react-router";
import { SectionsLayout } from "@/components/update-data/sections-layout";
import { updateDataSections } from "@/components/update-data/sections";

export const Route = createFileRoute("/update-data")({
  component: UpdateDataPage,
  staticData: { wide: true },
});

/** Bulk changes to the photo JSON on GitHub, one subpage each, picked from a side navigation. */
function UpdateDataPage() {
  return (
    <SectionsLayout
      name="Update Data"
      description="Bulk changes to every photo's JSON on GitHub. Each one previews what it will change, then saves it as changes waiting for Commit."
      sections={updateDataSections}
      to="/update-data/$section"
    />
  );
}
