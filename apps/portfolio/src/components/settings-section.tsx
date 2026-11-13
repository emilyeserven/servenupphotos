import type { ReactNode } from "react";

/**
 * One setting on the Settings page: its name as a heading, a few sentences on what it changes, and
 * its control below them. `id` names the heading, so a control can say it's labelled by it.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</div>
      </div>
      {children}
    </section>
  );
}
