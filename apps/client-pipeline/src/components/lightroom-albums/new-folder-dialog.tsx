import { type FormEvent, useState } from "react";
import { ErrorNote } from "@/components/error-note";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface NewFolderDialogProps {
  /** The album being moved, named in the title. */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Moves the album into the typed path and closes, or answers why it can't. */
  onMove: (folder: string) => string | undefined;
}

/** Asks for the path of a new folder to move an album into, such as Travel/Korea. */
export function NewFolderDialog({ name, open, onOpenChange, onMove }: NewFolderDialogProps) {
  const [path, setPath] = useState("");
  const [problem, setProblem] = useState<string>();
  const change = (next: boolean) => {
    setPath("");
    setProblem(undefined);
    onOpenChange(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const folder = path.trim();
    if (!folder) return;
    const why = onMove(folder);
    if (why) setProblem(why);
    else change(false);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Move “{name}” to a new folder</DialogTitle>
            <DialogDescription>Folders inside folders are split by /.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="New folder"
            placeholder="Travel/Korea"
            value={path}
            onChange={(event) => {
              setPath(event.target.value);
              setProblem(undefined);
            }}
          />
          <ErrorNote error={problem} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => change(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!path.trim()}>
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
