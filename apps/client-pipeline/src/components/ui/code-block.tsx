import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Ported from the shadcn/ui Code Block (radix base, rhea style):
// https://ui.shadcn.com/docs/components/radix/code-block
// The registry's style-specific `cn-code-block-*` classes are inlined as Tailwind.

const codeBlockVariants = cva(
  "group/code-block relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border text-xs has-[>[data-slot=code-block-content]:focus-visible]:ring-3 has-[>[data-slot=code-block-content]:focus-visible]:ring-ring/30",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        destructive:
          "bg-destructive/5 text-destructive border-destructive/15 dark:bg-destructive/10 dark:border-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function CodeBlock({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof codeBlockVariants>) {
  return (
    <div
      data-slot="code-block"
      data-variant={variant}
      className={cn(codeBlockVariants({ variant }), className)}
      {...props}
    />
  );
}

function CodeBlockHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-header"
      className={cn(
        "text-muted-foreground flex min-w-0 shrink-0 items-center gap-2 border-b px-4 py-2 *:has-[>[data-slot=code-block-title]]:min-w-0",
        className,
      )}
      {...props}
    />
  );
}

function CodeBlockTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-title"
      className={cn(
        "text-foreground min-w-0 truncate font-sans text-xs font-medium [&_svg]:pointer-events-none [&_svg]:inline-block [&_svg]:align-middle *:[svg]:me-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

function CodeBlockActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-actions"
      className={cn(
        "-my-1 -me-1.5 ms-auto flex shrink-0 items-center gap-1 [[data-slot=code-block]>&]:absolute [[data-slot=code-block]>&]:end-3 [[data-slot=code-block]>&]:top-3 [[data-slot=code-block]>&]:z-10 [[data-slot=code-block]>&]:m-0 [[data-slot=code-block]>&]:opacity-0 [[data-slot=code-block]>&]:transition-opacity [[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 [[data-slot=code-block]>&]:group-hover/code-block:opacity-100 [[data-slot=code-block]>&]:pointer-coarse:opacity-100 [[data-slot=code-block]>&]:*:[button]:bg-background [[data-slot=code-block]>&]:*:[button]:ring-1 [[data-slot=code-block]>&]:*:[button]:ring-foreground/10",
        className,
      )}
      {...props}
    />
  );
}

function CodeBlockCopyButton({
  value,
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const [label, Icon, announcement] = copied
    ? ["Copied", CheckIcon, "Copied"]
    : ["Copy", CopyIcon, ""];

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        data-slot="code-block-copy-button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        title={label}
        className={cn("hover:bg-foreground/5 dark:hover:bg-foreground/10", className)}
        onClick={(event) => {
          onClick?.(event);
          navigator.clipboard
            .writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        {...props}
      >
        <Icon />
      </Button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

// Boolean props render as present-or-absent data attributes, so `data-wrap:` variants match.
function dataFlag(on: boolean | undefined) {
  return on ? "" : undefined;
}

// With line numbers, a string child is split into one CodeBlockLine per line.
function toLines(children: React.ReactNode, lineNumbers: boolean | undefined) {
  if (!lineNumbers || typeof children !== "string") {
    return children;
  }
  return children
    .replace(/\n$/, "")
    .split("\n")
    .map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>);
}

function CodeBlockContent({
  className,
  children,
  style,
  wrap,
  lineNumbers,
  startLine = 1,
  ...props
}: React.ComponentProps<"pre"> & {
  wrap?: boolean;
  lineNumbers?: boolean;
  startLine?: number;
}) {
  return (
    <pre
      data-slot="code-block-content"
      data-wrap={dataFlag(wrap)}
      data-numbered={dataFlag(lineNumbers)}
      dir="ltr"
      tabIndex={0}
      style={{ counterReset: `line ${startLine - 1}`, ...style }}
      className={cn(
        "min-h-0 min-w-0 overflow-auto px-4 py-4 text-start font-mono leading-relaxed outline-none data-wrap:wrap-break-word data-wrap:whitespace-pre-wrap",
        className,
      )}
      {...props}
    >
      <code
        data-slot="code-block-code"
        className="grid min-h-lh min-w-max content-start in-data-numbered:grid-cols-[auto_1fr] in-data-wrap:min-w-0"
      >
        {toLines(children, lineNumbers)}
      </code>
    </pre>
  );
}

const codeBlockLineVariants = cva(
  "relative -mx-4 block min-h-lh px-4 before:min-w-6 before:text-end before:text-muted-foreground after:absolute after:start-1 after:top-0 after:text-muted-foreground after:select-none in-data-numbered:col-span-2 in-data-numbered:grid in-data-numbered:grid-cols-subgrid in-data-numbered:gap-x-3 in-data-numbered:[counter-increment:line] in-data-numbered:before:content-[counter(line)] in-data-numbered:before:select-none in-data-numbered:supports-[content:counter(line)_/_'']:before:content-[counter(line)_/_'']",
  {
    variants: {
      variant: {
        default: "",
        added: "bg-foreground/5 after:content-['+']",
        removed: "bg-destructive/10 after:text-destructive after:content-['−']",
        highlighted: "bg-foreground/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function CodeBlockLine({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof codeBlockLineVariants>) {
  // An empty line holds a newline so copying a selection keeps blank lines.
  const empty = React.Children.toArray(children).every((child) => child === "");

  return (
    <span
      data-slot="code-block-line"
      data-variant={variant}
      className={cn(codeBlockLineVariants({ variant }), className)}
      {...props}
    >
      <span data-slot="code-block-line-content" className="min-w-0">
        {empty ? "\n" : children}
      </span>
    </span>
  );
}

function CodeBlockFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-footer"
      className={cn(
        "text-muted-foreground flex min-w-0 shrink-0 items-center gap-2 px-4 pb-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
  CodeBlockLine,
  CodeBlockFooter,
};
