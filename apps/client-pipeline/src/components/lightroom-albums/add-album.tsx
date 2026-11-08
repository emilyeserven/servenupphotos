import { useForm } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "@/components/field-label";
import { type SwitchConfig, SettingsSwitch } from "@/components/settings-switch";
import { Button } from "@/components/ui/button";
import type { ComboboxOption } from "@/components/ui/combobox";
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
import { SingleCombobox } from "@/components/ui/single-combobox";
import type { LightroomItem } from "@/lib/lightroom-albums";
import { type ManualAlbum, folderPaths, manualAlbum, pathTaken } from "@/lib/lightroom-tree";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

const EMPTY: ManualAlbum = { name: "", folder: "", photoCount: null, offline: false };

/** Why the album can't be added: no name, or a folder or album at its path already. */
function problem(value: ManualAlbum, items: LightroomItem[]): string | undefined {
  if (!value.name.trim()) return "Give the album a name.";
  const { path } = manualAlbum(value);
  if (pathTaken(items, path)) return `There's already a folder or album at ${path}.`;
  return undefined;
}

/** Adds an album by hand, in a folder that's there or a new one, from a dialog. */
export function AddAlbumButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PlusIcon />
          Add album
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an album</DialogTitle>
          <DialogDescription>
            For an album the LLM missed, or one you haven&apos;t made in Lightroom yet. Albums added
            by hand stay when you import a new list.
          </DialogDescription>
        </DialogHeader>
        {open && <AddAlbumForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

/** The text beside each field's title, saying how to fill it in. */
const HELP = {
  name: "The album's name as Lightroom shows it, such as Busan, South Korea.",
  folder:
    "Pick a folder that's there, or type a new path such as Travel/Japan to make the folders it needs. Leave it empty for the top level.",
  photoCount: "How many photos Lightroom shows for the album. Leave it empty when you don't know.",
};

/** The Offline checkbox, which says whether Lightroom keeps the album on the device. */
const OFFLINE: SwitchConfig = {
  name: "offline",
  label: "Available offline in Lightroom",
  help: "The album has Make Available Offline turned on, so Next up can suggest it when you're offline.",
};

function AddAlbumForm({ onDone }: { onDone: () => void }) {
  const items = useLightroomAlbumsStore((state) => state.file?.items ?? []);
  const addAlbum = useLightroomAlbumsStore((state) => state.addAlbum);
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onSubmit: ({ value }) => problem(value, items) },
    onSubmit: ({ value }) => {
      addAlbum(manualAlbum(value));
      onDone();
    },
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="add-album-name" help={HELP.name}>
              Name
            </FieldLabel>
            <Input
              id="add-album-name"
              autoFocus
              value={field.state.value}
              placeholder="Busan, South Korea"
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="folder">
        {(field) => (
          <FolderField items={items} value={field.state.value} onChange={field.handleChange} />
        )}
      </form.Field>
      <form.Field name="photoCount">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="add-album-photos" help={HELP.photoCount}>
              Photos (optional)
            </FieldLabel>
            <Input
              id="add-album-photos"
              type="number"
              min={0}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="offline">
        {(field) => (
          <SettingsSwitch
            id="add-album-offline"
            config={OFFLINE}
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.errors}>
        {(errors) => <FormError errors={errors} />}
      </form.Subscribe>
      <DialogFooter>
        <Button type="submit">Add album</Button>
      </DialogFooter>
    </form>
  );
}

/** An option for each folder there is, plus the typed path when it's new, so it doesn't show as unknown. */
function folderOptions(items: LightroomItem[], value: string): ComboboxOption[] {
  const paths = folderPaths(items);
  const options = paths.map((path) => ({ value: path, label: path }));
  return value && !paths.includes(value) ? [...options, { value, label: value }] : options;
}

interface FolderFieldProps {
  items: LightroomItem[];
  value: string;
  onChange: (value: string) => void;
}

/** The folder to put the album in: pick one that's there, type a new path such as Travel/Japan, or leave it empty. */
function FolderField({ items, value, onChange }: FolderFieldProps) {
  return (
    <Field>
      <FieldLabel id="add-album-folder-label" help={HELP.folder}>
        Folder (optional)
      </FieldLabel>
      <SingleCombobox
        id="add-album-folder"
        aria-labelledby="add-album-folder-label"
        options={folderOptions(items, value)}
        value={value}
        onChange={onChange}
        placeholder="Top level, or a path such as Travel/Japan"
        emptyText="No folders yet. Type a path to make one."
        createLabel={(text) => `Make a new folder “${text}”`}
        onCreate={onChange}
      />
    </Field>
  );
}

/** A field's title and its input, stacked. */
function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/** The form's error, such as a missing name. */
function FormError({ errors }: { errors: unknown[] }) {
  const message = errors.find((e) => typeof e === "string");
  return message ? <p className="text-destructive text-sm">{message}</p> : null;
}
