import { useForm } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useId, useState } from "react";
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
          <Labeled label="Name">
            <Input
              autoFocus
              value={field.state.value}
              placeholder="Busan, South Korea"
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </Labeled>
        )}
      </form.Field>
      <form.Field name="folder">
        {(field) => (
          <FolderInput
            items={items}
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
          />
        )}
      </form.Field>
      <form.Field name="photoCount">
        {(field) => (
          <Labeled label="Photos (optional)">
            <Input
              type="number"
              min={0}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
            />
          </Labeled>
        )}
      </form.Field>
      <form.Field name="offline">
        {(field) => (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(e) => field.handleChange(e.target.checked)}
            />
            Available offline in Lightroom
          </label>
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

interface FolderInputProps {
  items: LightroomItem[];
  value: string;
  onChange: (value: string) => void;
}

/** The folder to put the album in: pick one that's there, type a new path such as Travel/Japan, or leave it empty. */
function FolderInput({ items, value, onChange }: FolderInputProps) {
  const listId = useId();
  return (
    <Labeled label="Folder (optional)">
      <Input
        list={listId}
        value={value}
        placeholder="Top level, or a path such as Travel/Japan"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {folderPaths(items).map((path) => (
          <option key={path} value={path} />
        ))}
      </datalist>
    </Labeled>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

/** The form's error, such as a missing name. */
function FormError({ errors }: { errors: unknown[] }) {
  const message = errors.find((e) => typeof e === "string");
  return message ? <p className="text-destructive text-sm">{message}</p> : null;
}
