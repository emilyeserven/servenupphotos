import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LanguagesIcon } from "lucide-react";
import { useState } from "react";
import {
  cacheSavedEntry,
  localizationId,
  type Place,
  saveLocalizationMutation,
} from "@/api/places";
import { FIELDS, type Fields, savedFields } from "@/components/localization-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * A button that opens a dialog to write how the place is written and said where it is, saved as
 * its localization, as on the Localizations page.
 */
export function PlaceLocalizationDialog({ place, disabled }: { place: Place; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Add how ${place.name} is written locally`}
          title="Add its romanization, pronunciation and local script"
          disabled={disabled}
        >
          <LanguagesIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Localize {place.name}</DialogTitle>
          <DialogDescription>
            How it's written and said where it is. Saved as its localization in the photo data pull
            request, as on the Localizations page.
          </DialogDescription>
        </DialogHeader>
        {open && <LocalizationForm place={place} onSaved={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function LocalizationForm({ place, onSaved }: { place: Place; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<Fields>(savedFields(undefined));
  const save = useMutation({
    ...saveLocalizationMutation,
    onSuccess: (result) => {
      cacheSavedEntry(queryClient, "localizations", result);
      onSaved();
    },
  });
  const empty = FIELDS.every(({ key }) => !fields[key].trim());
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const id = localizationId("place", place.name, place.id);
        save.mutate({ id, type: "place", name: place.name, ...fields });
      }}
    >
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2">
          <label htmlFor={`place-localization-${key}`} className="text-sm font-medium">
            {label}
          </label>
          <Input
            id={`place-localization-${key}`}
            value={fields[key]}
            disabled={save.isPending}
            onChange={(event) => setFields((f) => ({ ...f, [key]: event.target.value }))}
          />
        </div>
      ))}
      {save.error && <p className="text-destructive text-sm">{save.error.message}</p>}
      <DialogFooter>
        <Button type="submit" disabled={empty || save.isPending}>
          {save.isPending && <Spinner />}
          Save localization
        </Button>
      </DialogFooter>
    </form>
  );
}
