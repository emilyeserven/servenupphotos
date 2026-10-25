import { CheckIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PromptCopyButtonProps {
  /** What the button does, read out and shown on hover, such as "Copy a tag prompt for an LLM". */
  label: string;
  disabled: boolean;
  prompt: () => string;
  onCopied?: () => void;
}

/** A small sparkle button that copies an LLM prompt, showing a check for a moment once it has. */
export function PromptCopyButton({ label, disabled, prompt, onCopied }: PromptCopyButtonProps) {
  const [justCopied, setJustCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={justCopied ? "Copied" : label}
      title={label}
      disabled={disabled}
      onClick={() => {
        void navigator.clipboard.writeText(prompt()).then(() => {
          onCopied?.();
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        });
      }}
    >
      {justCopied ? <CheckIcon /> : <SparklesIcon />}
    </Button>
  );
}
