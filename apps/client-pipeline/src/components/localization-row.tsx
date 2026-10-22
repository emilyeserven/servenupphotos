import { type MutationState, useMutationState } from "@tanstack/react-query";
import type { Localization } from "@/api/places";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { LocalizationRow } from "@/lib/place-seeds";

/** The three fields a localization notes, as the JSON names them, with their labels. */
const FIELDS = [
  { key: "romanization", label: "Romanization" },
  { key: "pronunciation", label: "Local pronunciation" },
  { key: "localScript", label: "Local script" },
] as const;

/** A localization's romanization, local pronunciation and local script, as typed. */
export type Fields = Pick<Localization, (typeof FIELDS)[number]["key"]>;

/** The fields saved for a localization, empty when there's none. */
export function savedFields(saved: Localization | undefined): Fields {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, saved?.[key] ?? ""])) as Fields;
}

/** Whether the fields as typed differ from the row's saved ones. */
export function isChanged(row: LocalizationRow, fields: Fields): boolean {
  const saved = savedFields(row.saved);
  return FIELDS.some(({ key }) => fields[key].trim() !== saved[key].trim());
}

/** Where a row's latest save is: queued behind others, saving, saved, or failed. */
interface SaveState {
  status: "idle" | "queued" | "saving" | "saved" | "error";
  error?: string;
}

const IDLE: SaveState = { status: "idle" };

/** The state of the latest save of the localization `id`, from the mutation cache. */
function useSaveState(id: string): SaveState {
  const states = useMutationState({
    filters: {
      mutationKey: ["localizations", "save"],
      predicate: (m) => (m.state.variables as Localization | undefined)?.id === id,
    },
    select: (m) => saveStateOf(m.state),
  });
  return states.at(-1) ?? IDLE;
}

/** A settled save's state, by its mutation's status. */
const SETTLED = { idle: "idle", success: "saved", error: "error" } as const;

function saveStateOf(state: MutationState<unknown, Error>): SaveState {
  if (state.status === "pending") return { status: state.isPaused ? "queued" : "saving" };
  return { status: SETTLED[state.status], error: state.error?.message };
}

interface LocalizationRowFormProps {
  row: LocalizationRow;
  fields: Fields;
  onChange: (fields: Fields) => void;
  /** Queues a save of the row with these fields. */
  onSave: (fields: Fields) => void;
}

/** One country, city or place, with its three fields and a button to save them. */
export function LocalizationRowForm({ row, fields, onChange, onSave }: LocalizationRowFormProps) {
  const state = useSaveState(row.id);
  const busy = state.status === "queued" || state.status === "saving";
  return (
    <form
      className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(0,1fr))_7rem] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(fields);
      }}
    >
      <RowName row={row} />
      {FIELDS.map((field) => (
        <FieldInput
          key={field.key}
          id={`${row.id}-${field.key}`}
          field={field}
          value={fields[field.key]}
          disabled={busy}
          onChange={(value) => onChange({ ...fields, [field.key]: value })}
        />
      ))}
      <SaveButton changed={isChanged(row, fields)} state={state} />
      {state.error && <p className="text-destructive text-sm lg:col-span-5">{state.error}</p>}
    </form>
  );
}

/** What the row's button says for each save state, when it isn't plain Save. */
const SAVE_LABELS: Partial<Record<SaveState["status"], string>> = {
  queued: "Queued…",
  saving: "Saving…",
};

/** Saves the row once it's changed; says when its save is queued or running, and Saved after. */
function SaveButton({ changed, state }: { changed: boolean; state: SaveState }) {
  return (
    <Button type="submit" variant="outline" disabled={!canSave(state, changed)}>
      {state.status === "saving" && <Spinner />}
      {saveLabel(state, changed)}
    </Button>
  );
}

/** Whether the row has changes and no save of it is queued or running. */
function canSave(state: SaveState, changed: boolean): boolean {
  return changed && !(state.status in SAVE_LABELS);
}

function saveLabel(state: SaveState, changed: boolean): string {
  return SAVE_LABELS[state.status] ?? (state.status === "saved" && !changed ? "Saved" : "Save");
}

interface FieldInputProps {
  id: string;
  field: (typeof FIELDS)[number];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function FieldInput({ id, field, value, disabled, onChange }: FieldInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted-foreground text-xs">
        {field.label}
      </label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function RowName({ row }: { row: LocalizationRow }) {
  const photos = `${row.photos} photo${row.photos === 1 ? "" : "s"}`;
  return (
    <div className="min-w-0 self-center">
      <div className="truncate font-medium">{row.name}</div>
      <div className="text-muted-foreground truncate text-xs">
        {[row.detail, photos, row.saved ? undefined : "not saved yet"].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}
