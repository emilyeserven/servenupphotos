import type * as React from "react";

import { cn } from "@/lib/utils";

function CodeBlock({
  className,
  code,
  language,
  ...props
}: React.ComponentProps<"pre"> & { code: string; language?: string }) {
  return (
    <pre
      data-slot="code-block"
      data-language={language}
      className={cn(
        "bg-muted text-foreground max-h-[32rem] overflow-auto rounded-lg border p-4 font-mono text-xs leading-relaxed",
        className,
      )}
      {...props}
    >
      <code>{code}</code>
    </pre>
  );
}

export { CodeBlock };
