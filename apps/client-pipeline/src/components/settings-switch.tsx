import type { ReactNode } from "react";

/** A setting that's on or off, such as whether untitled photos are kept as drafts. */
export interface SwitchConfig {
  /** The stored setting's name. */
  name: string;
  label: string;
  help: ReactNode;
  /** True when the box is checked while the stored setting is false. */
  inverted?: boolean;
}

interface SettingsSwitchProps {
  id: string;
  config: SwitchConfig;
  /** The stored setting's value, before `inverted` is applied. */
  value: boolean;
  onChange: (value: boolean) => void;
}

/** A checkbox for an on-or-off setting, with what it does under its label. */
export function SettingsSwitch({ id, config, value, onChange }: SettingsSwitchProps) {
  const flip = (checked: boolean) => (config.inverted ? !checked : checked);
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4 cursor-pointer"
        checked={flip(value)}
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(flip(event.target.checked))}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {config.label}
        </label>
        <p id={`${id}-help`} className="text-muted-foreground text-sm">
          {config.help}
        </p>
      </div>
    </div>
  );
}
