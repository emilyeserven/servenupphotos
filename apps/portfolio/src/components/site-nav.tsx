import { Link } from "@tanstack/react-router";
import { portfolioViews } from "@/lib/portfolio-views";

export function SiteNav() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
        <Link to="/" className="mr-auto font-semibold tracking-tight">
          Serven Up Photos
        </Link>
        {portfolioViews.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="text-sm hover:text-foreground"
            activeProps={{ className: "font-medium text-foreground" }}
            inactiveProps={{ className: "text-muted-foreground" }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
