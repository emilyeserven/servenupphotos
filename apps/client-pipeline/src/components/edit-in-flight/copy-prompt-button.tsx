import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyPromptButtonProps {
  /** What the button says, such as "Copy tag prompt". */
  label: string;
  disabled: boolean;
  prompt: () => string;
  onCopied: () => void;
}

/** Copies an LLM prompt, saying so for a moment. */
export function CopyPromptButton({ label, disabled, prompt, onCopied }: CopyPromptButtonProps) {
  const [justCopied, setJustCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={disabled}
      onClick={() => {
        void navigator.clipboard.writeText(prompt()).then(() => {
          onCopied();
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        });
      }}
    >
      {justCopied ? <CheckIcon /> : <CopyIcon />}
      {justCopied ? "Copied" : label}
    </Button>
  );
}
