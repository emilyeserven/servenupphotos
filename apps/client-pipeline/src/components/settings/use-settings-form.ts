import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type SecretStatus,
  type SecretUpdate,
  type SettingsBody,
  type SettingsResponse,
  type SettingsSection,
  saveSettings,
  settingsQuery,
} from "@/api/settings";
import { connectionQueryKey } from "@/api/connections";
import { type SectionConfig } from "@/components/settings/sections";
import { useCombinedDataStore } from "@/stores/combined-data";

/** keep: leave the stored secret alone; replace: send a new one; clear: remove it. */
export type SecretDraft =
  | { action: "keep" }
  | { action: "replace"; value: string }
  | { action: "clear" };

/** What a Settings card's form holds: its text fields, its switches and the secret's draft. */
export interface FormValues {
  fields: Record<string, string>;
  switches: Record<string, boolean>;
  secret: SecretDraft;
}

/** The settings of one section as the backend stores them. */
export type StoredSection = SettingsResponse[SettingsSection];

function toFormValues(config: SectionConfig, stored: StoredSection): FormValues {
  const values = stored as unknown as Record<string, string>;
  const switches = stored as unknown as Record<string, boolean | undefined>;
  return {
    fields: Object.fromEntries(config.fields.map(({ name }) => [name, values[name] ?? ""])),
    switches: Object.fromEntries(
      config.switches.map(({ name }) => [name, Boolean(switches[name])]),
    ),
    secret: { action: "keep" },
  };
}

function toSettingsBody(config: SectionConfig, value: FormValues): SettingsBody {
  return {
    ...value.fields,
    ...value.switches,
    [config.secret.name]: toSecretUpdate(value.secret),
  };
}

function toSecretUpdate(draft: SecretDraft): SecretUpdate {
  if (draft.action === "replace") return draft.value;
  if (draft.action === "clear") return "";
  return undefined;
}

/** The form's check of the secret before a save: a replacement can't be empty. */
export function validateSecret(draft: SecretDraft): string | undefined {
  if (draft.action === "replace" && draft.value === "") return "Enter a new value, or cancel.";
  return undefined;
}

/** Whether the section's secret is stored, and its last characters when the backend shows them. */
export function secretStatusOf(config: SectionConfig, stored: StoredSection): SecretStatus {
  const statuses = stored as unknown as Record<string, SecretStatus | undefined>;
  return statuses[config.secret.name] ?? { set: false };
}

/**
 * A Settings card's form, its Save and Test connection mutations, and `clearResults`, which any
 * edit calls because it makes the last save or test result stale.
 */
export function useSettingsForm(config: SectionConfig, stored: StoredSection) {
  const queryClient = useQueryClient();
  const resetCombinedData = useCombinedDataStore((s) => s.reset);

  const save = useMutation({
    mutationFn: (value: FormValues) => saveSettings(config.section, toSettingsBody(config, value)),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsQuery.queryKey, data);
      void queryClient.invalidateQueries({ queryKey: connectionQueryKey(config.section) });
      // Another repository, branch or folder has other combined lists, and drafts change ALLPHOTOS.json.
      if (config.section === "github") resetCombinedData();
      form.reset(toFormValues(config, data[config.section]));
    },
  });

  const test = useMutation({
    mutationFn: (value: FormValues) => config.test!(toSettingsBody(config, value)),
  });

  const clearResults = () => {
    save.reset();
    test.reset();
  };

  const form = useForm({
    defaultValues: toFormValues(config, stored),
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value).catch(() => {});
    },
  });

  return { form, save, test, clearResults };
}

/** The form a Settings card renders, as `useSettingsForm` returns it. */
export type SettingsForm = ReturnType<typeof useSettingsForm>["form"];
