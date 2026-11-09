import type { ReactNode } from "react";
import { type SecretStatus } from "@/api/settings";
import { type SectionConfig } from "@/components/settings/sections";
import {
  type SecretDraft,
  type SettingsForm,
  validateSecret,
} from "@/components/settings/use-settings-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingsSecretProps {
  form: SettingsForm;
  config: SectionConfig;
  status: SecretStatus;
  /** Called before any change, since an edit makes the last save or test result stale. */
  onEdit: () => void;
}

/** A Settings card's secret, bound to the form, with the section's help under its label. */
export function SettingsSecret({ form, config, status, onEdit }: SettingsSecretProps) {
  return (
    <form.Field name="secret" validators={{ onSubmit: ({ value }) => validateSecret(value) }}>
      {(f) => (
        <SecretField
          id={`${config.section}-${config.secret.name}`}
          label={config.secret.label}
          help={
            config.secretHelp && (
              <form.Subscribe selector={(state) => state.values.fields}>
                {(fields) => config.secretHelp?.(fields)}
              </form.Subscribe>
            )
          }
          status={status}
          draft={f.state.value}
          error={f.state.meta.errors[0]}
          onChange={(draft) => {
            onEdit();
            f.handleChange(draft);
          }}
        />
      )}
    </form.Field>
  );
}

interface SecretFieldProps {
  id: string;
  label: string;
  help?: ReactNode;
  status: SecretStatus;
  draft: SecretDraft;
  error: string | undefined;
  onChange: (draft: SecretDraft) => void;
}

/** A write-only secret: shows whether one is stored, and lets you replace or clear it. */
function SecretField({ id, label, help, status, draft, error, onChange }: SecretFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {help}
      {draft.action === "replace" ? (
        <SecretInput
          id={id}
          value={draft.value}
          errorId={errorId}
          invalid={Boolean(error)}
          canCancel={status.set}
          onChange={onChange}
        />
      ) : (
        <SecretSummary
          id={id}
          status={status}
          clearing={draft.action === "clear"}
          onChange={onChange}
        />
      )}
      <p id={errorId} className="text-destructive text-sm empty:hidden">
        {error}
      </p>
    </div>
  );
}

interface SecretInputProps {
  id: string;
  value: string;
  errorId: string;
  invalid: boolean;
  canCancel: boolean;
  onChange: (draft: SecretDraft) => void;
}

function SecretInput({ id, value, errorId, invalid, canCancel, onChange }: SecretInputProps) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        autoFocus={canCancel}
        value={value}
        aria-invalid={invalid}
        aria-describedby={errorId}
        onChange={(event) => onChange({ action: "replace", value: event.target.value })}
      />
      {canCancel && (
        <Button type="button" variant="ghost" onClick={() => onChange({ action: "keep" })}>
          Cancel
        </Button>
      )}
    </div>
  );
}

interface SecretSummaryProps {
  id: string;
  status: SecretStatus;
  clearing: boolean;
  onChange: (draft: SecretDraft) => void;
}

function SecretSummary({ id, status, clearing, onChange }: SecretSummaryProps) {
  return (
    <div className="flex items-center gap-2">
      <p id={id} className="text-muted-foreground flex-1 font-mono text-sm">
        {describeSecret(status, clearing)}
      </p>
      <SecretActions isSet={status.set} clearing={clearing} onChange={onChange} />
    </div>
  );
}

interface SecretActionsProps {
  isSet: boolean;
  clearing: boolean;
  onChange: (draft: SecretDraft) => void;
}

function SecretActions({ isSet, clearing, onChange }: SecretActionsProps) {
  if (clearing) {
    return (
      <Button type="button" variant="ghost" onClick={() => onChange({ action: "keep" })}>
        Undo
      </Button>
    );
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange({ action: "replace", value: "" })}
      >
        {isSet ? "Replace" : "Set"}
      </Button>
      {isSet && (
        <Button type="button" variant="ghost" onClick={() => onChange({ action: "clear" })}>
          Clear
        </Button>
      )}
    </>
  );
}

function describeSecret(status: SecretStatus, clearing: boolean): string {
  if (clearing) return "Will be removed when you save";
  if (!status.set) return "Not set";
  return status.last4 ? `•••• ${status.last4}` : "••••••••";
}
