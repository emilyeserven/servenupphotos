import { Trash2Icon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ErrorNote } from "@/components/error-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/** The delete a card's button asks about, as a mutation's state and how to start it. */
interface PendingDelete {
  isPending: boolean;
  error: Error | null;
  reset: () => void;
  run: () => void;
}

interface ConfirmDeleteCardProps {
  /** The card's title, which is also what its buttons say, such as "Delete album". */
  action: string;
  /** Under the card's title: what deleting does, in a sentence. */
  description: ReactNode;
  /** The dialog's question, such as "Delete Korea?". */
  question: ReactNode;
  /** Under the question. */
  note: ReactNode;
  /** What goes with it, listed in the dialog. */
  children: ReactNode;
  remove: PendingDelete;
  disabled?: boolean;
}

/**
 * A card with a destructive button that opens a dialog asking first, listing what goes with the
 * thing, with Cancel and the button again to delete it. The dialog can't be closed mid-delete.
 */
export function ConfirmDeleteCard({
  action,
  description,
  question,
  note,
  children,
  remove,
  disabled,
}: ConfirmDeleteCardProps) {
  const [open, setOpen] = useState(false);
  const change = (next: boolean) => {
    if (remove.isPending) return;
    setOpen(next);
    remove.reset();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{action}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={change}>
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={disabled}>
              <Trash2Icon aria-hidden />
              {action}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{question}</DialogTitle>
              <DialogDescription>{note}</DialogDescription>
            </DialogHeader>
            {children}
            <ErrorNote error={remove.error} />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={remove.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="destructive" disabled={remove.isPending} onClick={remove.run}>
                {remove.isPending && <Spinner />}
                {action}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
