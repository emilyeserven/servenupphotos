import { useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, LinkIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { quickEditTarget } from "@/lib/quick-edit";

/**
 * The sidebar's Quick Edit button, under Bulk Upload: it opens a modal to paste a link from the
 * portfolio, and goes to the pipeline page that edits what the link shows, such as the photo
 * editor for a photo's link or an album's page for an album's (`lib/quick-edit.ts`).
 */
export function QuickEditButton({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-2 group-data-[collapsible=icon]:px-0">
      <Button
        variant="outline"
        className="w-full group-data-[collapsible=icon]:size-8"
        title="Quick Edit: open the page to edit something on the portfolio"
        onClick={() => setOpen(true)}
      >
        <LinkIcon aria-hidden />
        <span className="group-data-[collapsible=icon]:sr-only">Quick Edit</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>Quick Edit</DialogTitle>
                <DialogDescription>{QUICK_EDIT_HELP}</DialogDescription>
              </DialogHeader>
              <QuickEditForm
                onDone={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** What Quick Edit takes, under its title. */
export const QUICK_EDIT_HELP =
  "Paste a link from the portfolio to edit what it shows: a photo (or any view with one open), an album, a Trip, a tag, a genre or a place.";

/**
 * Quick Edit's field, in the modal and on the `/quick-edit` page: pasting a link that matches goes
 * straight to its page; Enter or Open goes too.
 */
export function QuickEditForm({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const target = text.trim() === "" ? undefined : quickEditTarget(text);

  function go(value: string) {
    const next = quickEditTarget(value);
    if (!("href" in next)) return;
    onDone?.();
    void navigate({ href: next.href });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(text);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          autoFocus
          aria-label="Portfolio link"
          placeholder="https://servenupphotos.net/photos/512/"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            // Replacing the whole field, as a paste into an empty one does, opens a match at once.
            if (text.trim() === "" && "href" in quickEditTarget(pasted)) {
              event.preventDefault();
              go(pasted);
            }
          }}
        />
        <Button type="submit" disabled={!target || !("href" in target)}>
          Open
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
      <TargetNote target={target} />
    </form>
  );
}

/** Under the field: where Open goes, or why the link can't be opened. */
function TargetNote({ target }: { target: ReturnType<typeof quickEditTarget> | undefined }) {
  if (!target) return null;
  if ("href" in target)
    return (
      <p className="text-sm text-muted-foreground">
        Opens <span className="font-medium text-foreground">{target.label}</span>.
      </p>
    );
  return (
    <p className="text-sm text-destructive" role="alert">
      {target.error}
    </p>
  );
}
