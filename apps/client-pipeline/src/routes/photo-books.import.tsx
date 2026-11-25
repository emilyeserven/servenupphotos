import { createFileRoute } from "@tanstack/react-router";
import { ImportBookPage } from "@/components/book-import/import-page";
import { fixedCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/photo-books/import")({
  component: ImportBookPage,
  staticData: { crumbs: fixedCrumbs("Import Book") },
});
