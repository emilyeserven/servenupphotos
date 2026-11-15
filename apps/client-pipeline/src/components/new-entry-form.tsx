import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NewEntryFormProps {
  /** The name box's label, such as "New book's name". */
  label: string;
  placeholder: string;
  /** The button's words, such as "Make book". */
  submit: string;
  /** Whether the new entry is being saved. */
  pending: boolean;
  /** Why saving it failed, if it did. */
  error: Error | null;
  /** Saves a new entry with the trimmed name. */
  onMake: (name: string) => void;
  /** Goes back to the saved entries; left out while there are none. */
  onCancel?: () => void;
}

/** A name box and a button that makes a new entry with it, such as a photo book or a Photo Set. */
export function NewEntryForm(props: NewEntryFormProps) {
  const { label, placeholder, submit, pending, error, onMake, onCancel } = props;
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onMake(name.trim());
      }}
    >
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-64"
        autoFocus
      />
      <Button type="submit" disabled={!name.trim() || pending}>
        <PlusIcon />
        {submit}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </form>
  );
}
