import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface CopyPromptButtonProps {
  label: string;
  /** Builds the prompt; undefined while what it needs is still loading. */
  prompt: (() => string) | undefined;
}

/** Copies an LLM prompt, and shows a check for a moment once it has. */
export function CopyPromptButton({ label, prompt }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!prompt) return;
    void navigator.clipboard.writeText(prompt()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={!prompt}
      onClick={copy}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </Button>
  );
}

interface AnswerBoxProps {
  /** The review button's label, such as "Review the tags". */
  label: string;
  pending: boolean;
  error: Error | null;
  onReview: (answer: string) => void;
}

/** The box to paste an LLM's JSON answer into, and the button that reviews it. */
export function AnswerBox({ label, pending, error, onReview }: AnswerBoxProps) {
  const [answer, setAnswer] = useState("");
  return (
    <>
      <Textarea
        aria-label="The LLM's answer"
        placeholder="Paste the LLM's JSON answer here"
        className="min-h-32 font-mono text-xs"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={answer.trim() === "" || pending}
        onClick={() => onReview(answer)}
      >
        {pending && <Spinner />}
        {label}
      </Button>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </>
  );
}
