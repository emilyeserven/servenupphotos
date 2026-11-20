import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** How big a section title is: a part of a card or panel, or a section of a page. */
type SectionTitleSize = "sm" | "lg";

/** The class each size of section title uses. */
const SIZE_CLASS: Record<SectionTitleSize, string> = {
  sm: "text-sm font-medium",
  lg: "text-lg font-semibold",
};

interface SectionTitleProps extends ComponentProps<"h2"> {
  /** The heading level, so the page's outline stays right; the look comes from `size`, not the level. */
  as?: "h2" | "h3";
  /** "sm" (the default) for a part of a card or panel, "lg" for a section of a page or drawer. */
  size?: SectionTitleSize;
}

/**
 * The title over a section of a page, card or panel, in one of the two looks the pipeline uses.
 * Extra classes (such as `flex` to put a count beside it) are added to the size's own.
 */
export function SectionTitle({
  as: Tag = "h3",
  size = "sm",
  className,
  ...props
}: SectionTitleProps) {
  return <Tag className={cn(SIZE_CLASS[size], className)} {...props} />;
}
