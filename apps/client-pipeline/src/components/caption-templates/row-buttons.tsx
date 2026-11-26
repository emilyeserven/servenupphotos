import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RowButtonProps {
  /** What it does, such as "Remove this exception" or "Add an exception". */
  label: string;
  onClick: () => void;
}

/** The X at the end of a row of a template's list, such as an exception, which removes it. */
export function RemoveRowButton({ label, onClick }: RowButtonProps) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <XIcon />
    </Button>
  );
}

/** The button under a template's list, such as its exceptions, which adds an empty row. */
export function AddRowButton({ label, onClick }: RowButtonProps) {
  return (
    <div>
      <Button variant="outline" size="sm" onClick={onClick}>
        <PlusIcon />
        {label}
      </Button>
    </div>
  );
}
