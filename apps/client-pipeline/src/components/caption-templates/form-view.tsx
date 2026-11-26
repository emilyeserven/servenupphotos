import type { CaptionValues } from "@/lib/caption-template";
import { type FormToken, formTokens } from "@/lib/place-form-tokens";
import { cn } from "@/lib/utils";

/** One piece of a form as drawn: typed text as it is, a value as a pill, a dropped part struck out. */
function Token({ token }: { token: FormToken }) {
  if (token.kind === "text") return <span className="whitespace-pre">{token.text}</span>;
  if (token.kind === "section") return <SectionToken token={token} />;
  return <ValueToken token={token} />;
}

/** A part in square brackets, struck out when it's left out. */
function SectionToken({ token }: { token: Extract<FormToken, { kind: "section" }> }) {
  return (
    <span
      className={cn(token.dropped && "line-through opacity-40")}
      title={token.dropped ? "Left out: a placeholder in it is empty" : undefined}
    >
      {token.tokens.map((t, i) => (
        <Token key={i} token={t} />
      ))}
    </span>
  );
}

/** A placeholder's value in a pill naming it when hovered, or its name dashed when it's empty. */
function ValueToken({ token }: { token: Extract<FormToken, { kind: "value" }> }) {
  const look = token.value
    ? "bg-primary/10 text-foreground"
    : "text-muted-foreground border border-dashed font-mono text-xs";
  return (
    <span title={`{${token.name}}`} className={cn("rounded px-1 py-0.5", look)}>
      {token.value || token.name}
    </span>
  );
}

interface FormViewProps {
  text: string;
  /** The values of the photo it's drawn for. */
  values: CaptionValues;
  /** Whether it's drawn struck through, as left out for the photo. */
  dropped?: boolean;
  /** Starts typing in the form. */
  onEdit: () => void;
  label: string;
}

/**
 * A place name form drawn as the caption shows it for a photo: each placeholder its value, in a
 * pill naming the placeholder when hovered, an empty one dashed with its name, and a part in square
 * brackets struck out when it's left out. Clicking it types in the form.
 */
export function FormView({ text, values, dropped, onEdit, label }: FormViewProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onEdit}
      title={
        dropped
          ? "Left out for this photo: a placeholder in it is empty, or it reads the same as a line above it"
          : undefined
      }
      className={cn(
        "border-input hover:bg-accent/50 min-h-9 min-w-48 flex-1 cursor-text rounded-md border px-3 py-1.5 text-left text-sm leading-relaxed",
        dropped && "line-through opacity-50",
      )}
    >
      {formTokens(text, values).map((token, i) => (
        <Token key={i} token={token} />
      ))}
    </button>
  );
}
