import { CheckIcon, SparklesIcon } from "lucide-react";
import { ShowTextButton, useCopyText } from "@/components/copy-text";
import { Button } from "@/components/ui/button";

interface PromptCopyButtonProps {
  /** What the button does, read out and shown on hover, such as "Copy a tag prompt for an LLM". */
  label: string;
  disabled: boolean;
  prompt: () => string;
  onCopied?: () => void;
}

/**
 * A small sparkle button that copies an LLM prompt, showing a check for a moment once it has, and a
 * button next to it that shows the whole prompt in a modal. The modal also opens when the browser
 * won't copy, as on a plain HTTP address.
 */
export function PromptCopyButton({ label, disabled, prompt, onCopied }: PromptCopyButtonProps) {
  const { copied, copy, show, dialog } = useCopyText({
    title: "The prompt",
    text: prompt,
    onCopied,
  });
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? "Copied" : label}
        title={label}
        disabled={disabled}
        onClick={copy}
      >
        {copied ? <CheckIcon /> : <SparklesIcon />}
      </Button>
      <ShowTextButton label="Show the prompt" size="icon-xs" disabled={disabled} onClick={show} />
      {dialog}
    </>
  );
}
