import { BracesIcon } from "lucide-react";

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

/** Pretty-prints a value as syntax-highlighted JSON with line numbers and a Copy button. */
export function JsonCodeBlock({ value, title = "JSON" }: { value: unknown; title?: string }) {
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
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers className="max-h-[32rem]">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}
