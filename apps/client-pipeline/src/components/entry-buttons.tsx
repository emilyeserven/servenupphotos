import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** A spinner while busy, inside a button. */
export function Busy({ busy }: { busy: boolean }) {
  return busy ? <Spinner /> : null;
}

/** Why the last save failed, or else why the file can't be saved yet, beside the buttons. */
export function SaveNote({ error, why }: { error: Error | null; why: string }) {
  if (error) return <span className="text-destructive text-sm">{error.message}</span>;
  return why ? <span className="text-muted-foreground text-sm">{why}</span> : null;
}

interface RemoveEntryButtonProps {
  /** Its text, such as "Remove group". */
  label: string;
  remove: { isPending: boolean; error: Error | null; mutate: () => void };
}

/** Removes a saved file, as a change waiting for Commit, with why it failed when it does. */
export function RemoveEntryButton({ label, remove }: RemoveEntryButtonProps) {
  return (
    <>
      <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>
        <Busy busy={remove.isPending} />
        {label}
      </Button>
      <SaveNote error={remove.error} why="" />
    </>
  );
}
