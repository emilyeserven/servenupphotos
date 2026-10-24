import { Link } from "@tanstack/react-router";
import { applyLocationNamesMutation, locationNamesPreviewQuery } from "@/api/data";
import { placesQuery } from "@/api/places";
import { FieldChangesCard } from "@/components/field-changes-card";
import { count } from "@/components/update-data-shared";

/** Writes every country, state and city that's another name of one as the name that wins over it. */
export function LocationNamesCard() {
  return (
    <FieldChangesCard
      title="Location names"
      description={
        <>
          Writes each country, state and city that&apos;s another name of one, such as “United
          States” for “United States of America”, as the name that wins, in every photo file (its{" "}
          <code>country</code>, <code>state</code>, <code>city</code>, <code>customCountry</code>,{" "}
          <code>customState</code> and <code>customCity</code>) and place file. Pick the other names
          on the{" "}
          <Link to="/places" className="text-foreground underline underline-offset-4">
            Places
          </Link>{" "}
          page. New photos get the winning names when their EXIF is read.
        </>
      }
      preview={locationNamesPreviewQuery}
      apply={applyLocationNamesMutation}
      renderUnchanged={(preview) => (
        <>
          All {count(preview.photoFiles, "photo file")} and{" "}
          {count(preview.placeFiles, "place file")} on <code>{preview.branch}</code> already use the
          winning names ({count(preview.otherNames, "other name")}), so there&apos;s nothing to
          change.
        </>
      )}
      total={(preview) => count(preview.photoFiles + preview.placeFiles, "photo and place file")}
      note={(file) => `${file.kind}, ${count(file.changes.length, "field")}`}
      refresh={[placesQuery.queryKey]}
    />
  );
}
