import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  optimisticEntry,
  type Localization,
  type LocalizationType,
  saveLocalizationMutation,
} from "@/api/places";
import { FieldLabel } from "@/components/field-label";
import { FIELDS, type Fields, savedFields } from "@/components/localization-row";
import { Input } from "@/components/ui/input";

/** How to fill in each localization field, shown beside its title. */
const HELP: Record<keyof Fields, string> = {
  romanization: "Optional. The name in Latin letters, such as Gyeongbokgung or Tōkyō.",
  pronunciation:
    "Optional. How the local script is read, such as furigana for kanji: とうきょう for 東京.",
  localScript: "Optional. The name in its own script, such as 경복궁 in hangeul or 東京 in kanji.",
};

/** What a localization is of: its type, name and ID. */
export interface LocalizationTarget {
  id: string;
  type: LocalizationType;
  name: string;
}

/** A localization's fields as typed in the edit panel, whether they differ from the saved ones, and saving them. */
export function useLocalizationDraft(saved: Localization | undefined) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<Fields>(() => savedFields(saved));
  const save = useMutation({
    ...saveLocalizationMutation,
    ...optimisticEntry(queryClient, "localizations"),
  });
  const before = savedFields(saved);
  const changed = FIELDS.some(({ key }) => fields[key].trim() !== before[key].trim());
  const set = (next: Fields) => {
    save.reset();
    setFields(next);
  };
  /** Saves the fields as the localization of target, with more of its fields, such as its other names. */
  const saveAs = (target: LocalizationTarget, more?: Partial<Localization>) =>
    save.mutate({ ...target, ...more, ...fields });
  return { fields, set, changed, save, saveAs };
}

/** The localization fields as typed, and saving them. */
export type LocalizationDraft = ReturnType<typeof useLocalizationDraft>;

interface LocalizationFieldsProps {
  draft: LocalizationDraft;
  /** Starts each input's ID, so they're unique on the page. */
  idPrefix: string;
  disabled: boolean;
}

/** Romanization, local pronunciation and local script, each with how to fill it in beside its title. */
export function LocalizationFields({ draft, idPrefix, disabled }: LocalizationFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-sm font-semibold">Localization</legend>
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2">
          <FieldLabel htmlFor={`${idPrefix}-${key}`} help={HELP[key]}>
            {label}
          </FieldLabel>
          <Input
            id={`${idPrefix}-${key}`}
            value={draft.fields[key]}
            disabled={disabled}
            onChange={(event) => draft.set({ ...draft.fields, [key]: event.target.value })}
          />
        </div>
      ))}
    </fieldset>
  );
}
