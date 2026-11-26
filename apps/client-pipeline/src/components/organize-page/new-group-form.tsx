import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  GROUP_KINDS,
  type GroupKind,
  type OrganizeResponse,
  createGroupMutation,
  groupId,
  groupName,
} from "@/api/organize";
import type { PublishResult } from "@/api/photos";
import { ErrorNote } from "@/components/error-note";
import { HideOnPortfolioCheckbox } from "@/components/hide-on-portfolio-checkbox";
import { GroupCombobox } from "@/components/photo-groups-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { validateGroupName } from "@/lib/group-name";

/** The form that saves a new album, tag or genre: its name, description, parent and, for an album, whether it's hidden. */
export function NewGroupForm({
  kind,
  folder,
  organize,
  onSaved,
}: {
  kind: GroupKind;
  /** The data folder, to show the file it saves. */
  folder: string;
  /** Every album and tag, to warn about a name or ID already taken; undefined until it's read. */
  organize?: OrganizeResponse;
  onSaved: (result: PublishResult) => void;
}) {
  const create = useMutation({ ...createGroupMutation(kind), onSuccess: onSaved });

  const form = useForm({
    defaultValues: { name: "", description: "", parent: [] as string[], hidden: false },
    validators: { onSubmit: ({ value }) => validateGroupName(organize, value.name) },
    onSubmit: async ({ value }) => {
      await create
        .mutateAsync({
          id: groupId(value.name),
          name: groupName(kind, value.name),
          description: value.description.trim(),
          parent: value.parent[0],
          hidden: kind === "albums" && value.hidden ? true : undefined,
        })
        .catch(() => {});
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
      <form.Field
        name="name"
        validators={{ onChange: ({ value }) => validateGroupName(organize, value) }}
      >
        {(field) => {
          const error = field.state.meta.isTouched ? field.state.meta.errors[0] : undefined;
          return (
            <FormField
              id={field.name}
              label="Name"
              error={error}
              hint={<IdHint folder={folder} kind={kind} id={groupId(field.state.value)} />}
            >
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                disabled={create.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={`${field.name}-hint`}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  create.reset();
                  field.handleChange(event.target.value);
                }}
              />
            </FormField>
          );
        }}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <FormField id={field.name} label="Description" hint="Optional.">
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              disabled={create.isPending}
              aria-describedby={`${field.name}-hint`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="parent">
        {(field) => (
          <FormField id={field.name} label={NEW_PARENT[kind].label} hint={NEW_PARENT[kind].hint}>
            <GroupCombobox
              id={field.name}
              kind={kind}
              multiple={false}
              value={field.state.value}
              disabled={create.isPending}
              placeholder={NEW_PARENT[kind].none}
              aria-describedby={`${field.name}-hint`}
              onChange={(parent) => field.handleChange(parent)}
            />
          </FormField>
        )}
      </form.Field>

      {kind === "albums" && (
        <form.Field name="hidden">
          {(field) => (
            <HideOnPortfolioCheckbox
              what="the album"
              checked={field.state.value}
              disabled={create.isPending}
              onChange={(hidden) => field.handleChange(hidden)}
            />
          )}
        </form.Field>
      )}

      <ErrorNote error={create.error} />

      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button type="submit" className="self-start" disabled={!canSubmit || create.isPending}>
            {create.isPending && <Spinner />}
            {create.isPending ? "Saving…" : `Add ${GROUP_KINDS[kind].singular}`}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/** The new album or tag form's parent field, for each kind with parents. */
const NEW_PARENT: Record<GroupKind, { label: string; hint: string; none: string }> = {
  albums: {
    label: "Parent album",
    hint: "Optional. Puts this album inside another, as one of its sub-albums.",
    none: "None: a top-level album",
  },
  tags: {
    label: "Parent tag",
    hint: "Optional. A more general tag this one is a kind of, such as covered-street for shotengai, so filtering by it shows this tag's photos too.",
    none: "None: a top-level tag",
  },
  genres: {
    label: "Parent genre",
    hint: "Optional. Makes this a subgenre of a broader genre, such as Traditional architecture under Architecture, so filtering by it shows this genre's photos too.",
    none: "None: a top-level genre",
  },
};

/** How the ID hint says where the ID comes from: a tag's name is its ID too. */
const ID_HINTS: Record<GroupKind, { lead: string; made: string }> = {
  albums: { lead: "ID", made: ", made from the name" },
  tags: { lead: "Saved as", made: ", in lowercase kebab-case, as its name and ID" },
  genres: { lead: "ID", made: ", made from the name" },
};

/** The ID made from the name, which photos list it by, and the file it's saved as. */
function IdHint({ folder, kind, id }: { folder: string; kind: GroupKind; id: string }) {
  return (
    <>
      {ID_HINTS[kind].lead} <code>{id || "…"}</code>
      {ID_HINTS[kind].made}. Saves{" "}
      <code className="break-all">
        {folder}/{kind}/{id || "…"}.json
      </code>
      .
    </>
  );
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {error ? <ErrorNote error={error} /> : hint}
        </p>
      )}
    </div>
  );
}
