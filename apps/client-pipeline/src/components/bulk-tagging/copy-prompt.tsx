import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyPromptProps {
  /** What the button says, such as "Copy the tag prompt for 5 photos". */
  label: string;
  disabled: boolean;
  /** The prompt to copy, or null when it can't be written yet. */
  prompt: () => string | null;
}

/** A button that copies a bulk LLM prompt, saying "Copied" for a moment once it has. */
export function CopyPrompt({ label, disabled, prompt }: CopyPromptProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = prompt();
    if (text === null) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={disabled}
      onClick={copy}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </Button>
  );
}
