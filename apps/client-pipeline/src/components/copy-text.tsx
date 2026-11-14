import { CheckIcon, CopyIcon, ScrollTextIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/copy-text";

interface CopyTextOptions {
  /** The modal's title when the text is shown, such as "The tag prompt". */
  title: string;
  /** Makes the text to copy, only when it's needed. */
  text: () => string;
  /** Called once the text is copied, or shown for copying by hand. */
  onCopied?: () => void;
}

/** What `useCopyText` gives a copy button. */
interface CopyText {
  /** True for a moment after the text was copied, to show a check. */
  copied: boolean;
  /** Copies the text, or opens the modal with it when the browser won't copy. */
  copy: () => void;
  /** Opens the modal with the text, to read or copy by hand. */
  show: () => void;
  /** The modal, to render next to the button. */
  dialog: ReactNode;
}

/**
 * Copies text from a button, and when the browser can't (the pipeline opened over plain HTTP),
 * shows it in a modal instead, selected and ready to copy by hand.
 */
export function useCopyText({ title, text, onCopied }: CopyTextOptions): CopyText {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState<ShownText | null>(null);
  const show = () => {
    setShown({ text: text(), failed: false });
    onCopied?.();
  };
  const copy = () => {
    const value = text();
    void copyText(value).then((ok) => {
      onCopied?.();
      if (!ok) {
        setShown({ text: value, failed: true });
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const dialog = <TextDialog title={title} shown={shown} onClose={() => setShown(null)} />;
  return { copied, copy, show, dialog };
}

/** The text in the modal, and whether it opened because the browser wouldn't copy it. */
interface ShownText {
  text: string;
  failed: boolean;
}

interface TextDialogProps {
  title: string;
  /** The text, and whether the browser already wouldn't copy it; null while the modal is closed. */
  shown: ShownText | null;
  onClose: () => void;
}

/** A modal with the whole text in a read-only box, selected when it opens, and a Copy button. */
function TextDialog({ title, shown, onClose }: TextDialogProps) {
  return (
    <Dialog
      open={shown !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        {shown && <TextDialogBody title={title} shown={shown} onCopied={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

interface TextDialogBodyProps {
  title: string;
  shown: ShownText;
  onCopied: () => void;
}

/** The modal's title, hint, text box and Copy button, made fresh each time it opens. */
function TextDialogBody({ title, shown, onCopied }: TextDialogBodyProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [failed, setFailed] = useState(shown.failed);
  const copy = () => {
    void copyText(shown.text).then((ok) => {
      if (ok) {
        onCopied();
        return;
      }
      setFailed(true);
      box.current?.select();
    });
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          <CopyHint failed={failed} />
        </DialogDescription>
      </DialogHeader>
      <Textarea
        ref={box}
        readOnly
        autoFocus
        aria-label={title}
        value={shown.text}
        className="max-h-[60vh] min-h-40 overflow-auto font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <DialogFooter>
        <Button type="button" onClick={copy}>
          <CopyIcon />
          Copy
        </Button>
      </DialogFooter>
    </>
  );
}

/** Says how to copy the text: by hand, once the browser wouldn't. */
function CopyHint({ failed }: { failed: boolean }) {
  return failed
    ? "This browser won't copy from here. The text is selected: press Ctrl+C (⌘C on a Mac) to copy it."
    : "Select the text and copy it, or press Copy.";
}

interface ShowTextButtonProps {
  /** What the button shows, read out and on hover, such as "Show the prompt". */
  label: string;
  disabled?: boolean;
  /** The button's size, to match the copy button next to it. */
  size?: "icon" | "icon-lg" | "icon-xs";
  onClick: () => void;
}

/** A small button that opens the modal with the whole text. */
export function ShowTextButton({ label, disabled, size = "icon", onClick }: ShowTextButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <ScrollTextIcon />
    </Button>
  );
}

/** The show button's size for each copy button size, so the two line up. */
const showSizes = { default: "icon", lg: "icon-lg" } as const;

interface CopyTextButtonProps extends CopyTextOptions {
  /** The button's text, such as "Copy the tag prompt for 5 photos". */
  label: string;
  disabled?: boolean;
  size?: "default" | "lg";
  /** The show button's label, such as "Show the prompt", or leave out when the page shows the text already. */
  showLabel?: string;
}

/**
 * A Copy button that shows "Copied" for a moment once it has copied, with a small button next to
 * it that opens the whole text in a modal. When the browser won't copy, the modal opens instead.
 */
export function CopyTextButton({
  label,
  disabled,
  size = "default",
  showLabel,
  ...options
}: CopyTextButtonProps) {
  const { copied, copy, show, dialog } = useCopyText(options);
  return (
    <div className="flex items-center gap-1 self-start">
      <Button type="button" variant="outline" size={size} disabled={disabled} onClick={copy}>
        <CopyLabel copied={copied} label={label} />
      </Button>
      {showLabel && (
        <ShowTextButton
          label={showLabel}
          disabled={disabled}
          size={showSizes[size]}
          onClick={show}
        />
      )}
      {dialog}
    </div>
  );
}

/** The copy button's icon and words: a check and "Copied" for a moment once it has copied. */
function CopyLabel({ copied, label }: { copied: boolean; label: string }) {
  return copied ? (
    <>
      <CheckIcon />
      Copied
    </>
  ) : (
    <>
      <CopyIcon />
      {label}
    </>
  );
}
