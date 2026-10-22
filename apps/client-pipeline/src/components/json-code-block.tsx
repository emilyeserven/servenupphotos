import { BracesIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { cn } from "@/lib/utils";

/** Pretty-prints a value as syntax-highlighted JSON with line numbers and a Copy button. */
export function JsonCodeBlock({
  value,
  title = "JSON",
  contentClassName,
  actions,
}: {
  value: unknown;
  title?: string;
  /** Overrides the content's classes, such as its default max height. */
  contentClassName?: string;
  /** Controls shown in the header before the Copy button. */
  actions?: ReactNode;
}) {
  const code = JSON.stringify(value, null, 2);
  const lines = useHighlightedCode(code, "json");

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <BracesIcon />
          {title}
        </CodeBlockTitle>
        <CodeBlockActions>
          {actions}
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers className={cn("max-h-[32rem]", contentClassName)}>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}
