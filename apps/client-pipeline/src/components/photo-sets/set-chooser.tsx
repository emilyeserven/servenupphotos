import { useMutation } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { PhotoSet } from "@portfolio/lib/photo-sets";
import { deletePhotoSetMutation, photoSetId, savePhotoSetMutation } from "@/api/photo-sets";
import { NewEntryForm } from "@/components/new-entry-form";
import { Button } from "@/components/ui/button";

interface SetChooserProps {
  sets: PhotoSet[];
  chosen: PhotoSet | undefined;
  onChoose: (id: string | undefined) => void;
}

/** The set being edited, picked from a list of every set, and **New set** to make another. */
export function SetChooser({ sets, chosen, onChoose }: SetChooserProps) {
  const [naming, setNaming] = useState(sets.length === 0);
  if (naming || !chosen) {
    return (
      <NewSetForm
        taken={sets.map((set) => set.id)}
        onCancel={sets.length > 0 ? () => setNaming(false) : undefined}
        onMade={(id) => {
          setNaming(false);
          onChoose(id);
        }}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Photo Set"
        value={chosen.id}
        onChange={(event) => onChoose(event.target.value)}
        className="border-input dark:bg-input/30 h-9 min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs"
      >
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.name} ({set.photos.length})
          </option>
        ))}
      </select>
      <Button variant="outline" onClick={() => setNaming(true)}>
        <PlusIcon />
        New set
      </Button>
      <DeleteSetButton set={chosen} onDeleted={() => onChoose(undefined)} />
    </div>
  );
}

interface NewSetFormProps {
  /** The IDs the other sets have. */
  taken: string[];
  onCancel?: () => void;
  onMade: (id: string) => void;
}

/** A name for a new set, saved with no photos yet. */
function NewSetForm({ taken, onCancel, onMade }: NewSetFormProps) {
  const save = useMutation(savePhotoSetMutation);
  const make = (name: string) => {
    const id = photoSetId(name, taken);
    save.mutate({ id, name, photos: [] }, { onSuccess: () => onMade(id) });
  };
  return (
    <NewEntryForm
      label="New set's name"
      placeholder="Name the set, such as Night market"
      submit="Make set"
      pending={save.isPending}
      error={save.error}
      onMake={make}
      onCancel={onCancel}
    />
  );
}

/** Removes the set, after asking, as a change waiting for Commit; its photos stay as they are. */
function DeleteSetButton({ set, onDeleted }: { set: PhotoSet; onDeleted: () => void }) {
  const remove = useMutation(deletePhotoSetMutation);
  return (
    <Button
      variant="ghost"
      disabled={remove.isPending}
      onClick={() => {
        if (window.confirm(`Remove the Photo Set “${set.name}”? Its photos stay as they are.`))
          remove.mutate(set.id, { onSuccess: onDeleted });
      }}
    >
      <Trash2Icon />
      Remove set
    </Button>
  );
}
