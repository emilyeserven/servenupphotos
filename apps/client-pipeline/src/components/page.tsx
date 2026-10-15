import type { ReactNode } from "react";

interface PageProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** Centered page column with a title and description. */
export function Page({ title, description, children }: PageProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  );
}
