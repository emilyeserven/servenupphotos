import * as React from "react";

import type { loadHighlighter } from "@/lib/highlighter";

/**
 * Highlights code with Shiki and returns one React node per line. Returns plain lines
 * until the language has loaded, and for a language that is not listed.
 *
 * Ported from the shadcn/ui Code Block:
 * https://ui.shadcn.com/docs/components/radix/code-block#syntax-highlighting
 */
export function useHighlightedCode(value: string, language: string) {
  // A trailing newline would render as an extra empty line.
  const code = value.endsWith("\n") ? value.slice(0, -1) : value;
  const [loaded, setLoaded] = React.useState<{
    language: string;
    highlighter: Awaited<ReturnType<typeof loadHighlighter>>;
  } | null>(null);
  const highlighter = loaded?.language === language ? loaded.highlighter : null;

  React.useEffect(() => {
    let cancelled = false;

    // Shiki loads on first use, so it stays out of the page's own bundle.
    import("@/lib/highlighter")
      .then((module) => module.loadHighlighter(language))
      .then((next) => {
        if (!cancelled) {
          setLoaded({ language, highlighter: next });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language]);

  return React.useMemo(
    () => (highlighter ? highlighter.highlight(code).lines : code.split("\n")),
    [code, highlighter],
  );
}
