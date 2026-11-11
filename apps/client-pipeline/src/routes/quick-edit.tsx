import { createFileRoute, redirect } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { QUICK_EDIT_HELP, QuickEditForm } from "@/components/quick-edit-button";
import { quickEditTarget } from "@/lib/quick-edit";

/** The `/quick-edit` page's search: the portfolio link to edit, as the Chrome extension sends it. */
interface QuickEditSearch {
  url?: string;
}

export const Route = createFileRoute("/quick-edit")({
  validateSearch: (search: Record<string, unknown>): QuickEditSearch =>
    typeof search.url === "string" && search.url !== "" ? { url: search.url } : {},
  // A link that matches goes straight to its page, so the extension's click lands on the editor.
  beforeLoad: ({ search }) => {
    const target = search.url ? quickEditTarget(search.url) : undefined;
    if (target && "href" in target) throw redirect({ href: target.href, replace: true });
  },
  component: QuickEditPage,
});

/**
 * Quick Edit as a page: where the Chrome extension's button lands when its link has nothing to
 * edit, saying why, with the field to paste another.
 */
function QuickEditPage() {
  const { url } = Route.useSearch();
  const target = url ? quickEditTarget(url) : undefined;
  return (
    <Page title="Quick Edit" description={QUICK_EDIT_HELP}>
      {target && "error" in target && (
        <p className="text-sm">
          <span className="break-all text-muted-foreground">{url}</span>
          <br />
          <span className="text-destructive" role="alert">
            {target.error}
          </span>
        </p>
      )}
      <QuickEditForm />
    </Page>
  );
}
