import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Use a wider column, for pages that lay content out side by side. */
  wide?: boolean;
}

/** Centered page column with a title and description. */
export function Page({ title, description, children, wide = false }: PageProps) {
  return (
    <div className={cn("mx-auto flex flex-col gap-6 p-6", wide ? "max-w-6xl" : "max-w-2xl")}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  );
}
