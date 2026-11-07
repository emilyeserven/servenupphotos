import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { UpdateDataSection } from "@/components/update-data/sections";

/** The URL of a page with subpages picked from a side navigation: Update Data or Tag Data. */
export type SectionsRoute = "/update-data/$section" | "/tag-data/$section";

interface SectionNavProps {
  /** The page's name, such as Update Data, which labels the navigation. */
  name: string;
  sections: readonly UpdateDataSection[];
  to: SectionsRoute;
  current: string | undefined;
}

/**
 * A side navigation of subpages, as on Update Data and Tag Data: one link per subpage, its icon left
 * of its name. On a phone it's a dropdown above the card instead, so the card keeps the whole width.
 */
export function SectionNav({ name, sections, to, current }: SectionNavProps) {
  return (
    <>
      <SectionSelect name={name} sections={sections} to={to} current={current} />
      <nav aria-label={name} className="hidden w-48 shrink-0 md:block">
        <ul className="sticky top-4 flex flex-col gap-0.5">
          {sections.map((section) => (
            <li key={section.slug}>
              <Link
                to={to}
                params={{ section: section.slug }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm [&>svg]:size-4 [&>svg]:shrink-0",
                  section.slug === current
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <section.icon aria-hidden />
                <span>{section.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** The phone's dropdown of subpages, which opens the one picked. */
function SectionSelect({ name, sections, to, current }: SectionNavProps) {
  const navigate = useNavigate();
  return (
    <select
      aria-label={`${name} subpage`}
      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm md:hidden"
      value={current ?? ""}
      onChange={(e) => void navigate({ to, params: { section: e.target.value } })}
    >
      {sections.map((section) => (
        <option key={section.slug} value={section.slug}>
          {section.title}
        </option>
      ))}
    </select>
  );
}
