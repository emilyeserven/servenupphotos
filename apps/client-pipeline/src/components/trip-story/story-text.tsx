import { Maximize2, Plus } from "lucide-react";
import { useState } from "react";
import { MarkdownField } from "@/components/album-layout/markdown-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StoryTextProps {
  /** What the text is, such as "Paragraph between photos". */
  label: string;
  /** The button that opens the box while it's empty, such as "Add a paragraph". */
  addLabel: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Markdown text on the Trip page: a button until it's wanted, then a small box with a preview and
 * an expand button that opens the same text in a large box.
 */
export function StoryText({ label, addLabel, value, onChange }: StoryTextProps) {
  const [open, setOpen] = useState(value !== "");
  const [large, setLarge] = useState(false);
  if (!open) {
    return (
      <Button size="xs" variant="ghost" className="w-fit" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {addLabel}
      </Button>
    );
  }
  return (
    <>
      <MarkdownField
        label={label}
        value={value}
        onChange={onChange}
        action={<ExpandButton onClick={() => setLarge(true)} />}
      />
      <LargeText open={large} onOpenChange={setLarge} {...{ label, value, onChange }} />
    </>
  );
}

function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      title="Write in a larger box"
      aria-label="Expand"
      onClick={onClick}
    >
      <Maximize2 aria-hidden />
    </Button>
  );
}

interface LargeTextProps extends Omit<StoryTextProps, "addLabel"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The text in a large box, in a dialog over the page; it changes as typed, like the small box. */
function LargeText({ open, onOpenChange, label, value, onChange }: LargeTextProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Markdown works here. Close this when you&apos;re done; nothing is lost.
          </DialogDescription>
        </DialogHeader>
        <MarkdownField
          label={label}
          value={value}
          onChange={onChange}
          boxClassName="min-h-[50vh]"
        />
      </DialogContent>
    </Dialog>
  );
}
