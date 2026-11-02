import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * The site's name, "Serven Up Photos", as a small link back to the homepage, shown at the top left
 * of every page above its title and at the top of the site menu.
 */
export function SiteHomeLink({
  className,
  onClick,
}: {
  className?: string;
  /** Called when the link is clicked, such as to close the menu it's in. */
  onClick?: () => void;
}) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={cn(
        "inline-block text-sm font-medium tracking-tight text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:underline",
        className,
      )}
    >
      Serven Up Photos
    </Link>
  );
}
