import { useForm } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RenameFormProps {
  /** The input's id, unique on the page. */
  id: string;
  /** The name it starts with: a free one the backend offered, without the extension. */
  suggested: string;
  /** The extension the name gets, shown after the input, such as ".jpg". */
  extension: string;
  /** The submit button's words, such as "Rename and upload". */
  submitLabel: string;
  /** Why a name can't be used, or undefined when it can. */
  validate: (name: string) => string | undefined;
  /** Called with the trimmed new name. */
  onRename: (name: string) => void;
  disabled?: boolean;
  /** More buttons after the submit button, such as keeping the name. */
  children?: ReactNode;
}

/**
 * Offers a new name when the one a photo would be uploaded or saved under is taken: an input
 * filled in with a free name, which can be changed, and a button to try again with it.
 */
export function RenameForm({
  id,
  suggested,
  extension,
  submitLabel,
  validate,
  onRename,
  disabled,
  children,
}: RenameFormProps) {
  const form = useForm({
    defaultValues: { name: suggested },
    onSubmit: ({ value }) => onRename(value.name.trim()),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <form.Field name="name" validators={{ onChange: ({ value }) => validate(value) }}>
        {(field) => (
          <RenameField
            id={id}
            extension={extension}
            value={field.state.value}
            error={field.state.meta.errors[0]}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <div className="flex flex-wrap gap-2">
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button type="submit" size="sm" disabled={!canSubmit || disabled}>
              {submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {children}
      </div>
    </form>
  );
}

interface RenameFieldProps {
  id: string;
  extension: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function RenameField({ id, extension, value, error, onChange, onBlur }: RenameFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        New name
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error !== undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="text-muted-foreground text-sm">{extension}</span>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
