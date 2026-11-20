import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmStore } from "@/stores/confirm";

/**
 * The app's one confirm dialog, mounted once at the root: the question `askFirst` asks, with Cancel
 * and a button that goes ahead. Closing it any other way counts as Cancel.
 */
export function ConfirmDialog() {
  const open = useConfirmStore((state) => state.open);
  return (
    <Dialog open={open !== null} onOpenChange={(next) => !next && open?.answer(false)}>
      {open && (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{open.question}</DialogTitle>
            {/* Radix wants a description; an empty one keeps it quiet when there's no note. */}
            <DialogDescription>{open.note ?? ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => open.answer(false)}>
              Cancel
            </Button>
            <Button
              variant={open.destructive === false ? "default" : "destructive"}
              onClick={() => open.answer(true)}
            >
              {open.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
