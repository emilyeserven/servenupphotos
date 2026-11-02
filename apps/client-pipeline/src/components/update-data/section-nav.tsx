import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { updateDataSections } from "@/components/update-data/sections";

/**
 * Update Data's side navigation, one link per subpage. On a phone it's a dropdown above the card
 * instead, so the card keeps the whole width.
 */
export function UpdateDataNav({ current }: { current: string | undefined }) {
  return (
    <>
      <SectionSelect current={current} />
      <nav aria-label="Update Data" className="hidden w-48 shrink-0 md:block">
        <ul className="sticky top-4 flex flex-col gap-0.5">
          {updateDataSections.map((section) => (
            <li key={section.slug}>
              <Link
                to="/update-data/$section"
                params={{ section: section.slug }}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm",
                  section.slug === current
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {section.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** The phone's dropdown of subpages, which opens the one picked. */
function SectionSelect({ current }: { current: string | undefined }) {
  const navigate = useNavigate();
  return (
    <select
      aria-label="Update Data subpage"
      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm md:hidden"
      value={current ?? ""}
      onChange={(e) =>
        void navigate({ to: "/update-data/$section", params: { section: e.target.value } })
      }
    >
      {updateDataSections.map((section) => (
        <option key={section.slug} value={section.slug}>
          {section.title}
        </option>
      ))}
    </select>
  );
}
