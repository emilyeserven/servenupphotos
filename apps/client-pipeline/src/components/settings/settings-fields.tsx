import { type FieldConfig, type SectionConfig } from "@/components/settings/sections";
import { type SettingsForm } from "@/components/settings/use-settings-form";
import { SettingsSwitch } from "@/components/settings-switch";
import { Input } from "@/components/ui/input";

interface SettingsFieldsProps {
  form: SettingsForm;
  config: SectionConfig;
  /** Called before any change, since an edit makes the last save or test result stale. */
  onEdit: () => void;
}

/** A Settings card's text fields, then its on-or-off settings, each bound to the form. */
export function SettingsFields({ form, config, onEdit }: SettingsFieldsProps) {
  return (
    <>
      {config.fields.map((field) => (
        <form.Field key={field.name} name={`fields.${field.name}`}>
          {(f) => (
            <TextField
              id={`${config.section}-${field.name}`}
              config={field}
              value={f.state.value}
              onBlur={f.handleBlur}
              onChange={(value) => {
                onEdit();
                f.handleChange(value);
              }}
            />
          )}
        </form.Field>
      ))}

      {config.switches.map((sw) => (
        <form.Field key={sw.name} name={`switches.${sw.name}`}>
          {(f) => (
            <SettingsSwitch
              id={`${config.section}-${sw.name}`}
              config={sw}
              value={f.state.value}
              onChange={(value) => {
                onEdit();
                f.handleChange(value);
              }}
            />
          )}
        </form.Field>
      ))}
    </>
  );
}

interface TextFieldProps {
  id: string;
  config: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function TextField({ id, config, value, onChange, onBlur }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {config.label}
      </label>
      <Input
        id={id}
        value={value}
        placeholder={config.placeholder}
        autoComplete="off"
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
