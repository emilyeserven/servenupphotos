import { createFileRoute, redirect } from "@tanstack/react-router";

// The Photo Book was one page with a book picker; a link to it opens the Photo Books page, or the
// book its `?book=` named.
export const Route = createFileRoute("/photo-book")({
  validateSearch: (search: Record<string, unknown>): { book?: string } => ({
    book: typeof search.book === "string" && search.book ? search.book : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.book) {
      throw redirect({ to: "/photo-books/$id", params: { id: search.book }, replace: true });
    }
    throw redirect({ to: "/photo-books", replace: true });
  },
});
