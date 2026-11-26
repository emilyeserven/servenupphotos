import { useRef, useState } from "react";
import {
  type CaptionTemplate,
  captionTemplateId,
  deleteCaptionTemplateMutation,
  saveCaptionTemplateMutation,
} from "@/api/captions";
import type { CombinedData } from "@/api/photos";
import { PlaceFormBuilder } from "@/components/caption-templates/place-form-builder";
import { PlaceholderList } from "@/components/caption-templates/placeholder-list";
import { TemplatePreview } from "@/components/caption-templates/preview";
import { StyleButtons } from "@/components/caption-templates/style-buttons";
import { EntryEditorButtons } from "@/components/entry-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STARTER_TEMPLATE } from "@/lib/caption-template";
import { PHOTO_BOOK_PLATFORM, socialPlatforms } from "@/lib/social-posts";

const NEW: CaptionTemplate = { id: "", name: "", platform: "", template: STARTER_TEMPLATE };

/** The template the typed one saves, keeping a saved template's ID. */
function templateOf(draft: CaptionTemplate, saved?: CaptionTemplate): CaptionTemplate {
  return {
    id: saved?.id ?? captionTemplateId(draft.name),
    name: draft.name.trim(),
    platform: draft.platform,
    template: draft.template.trimEnd(),
    ...placesOf(draft),
  };
}

/** The place name builder's forms to save, without empty ones; none while there are none. */
function placesOf(draft: CaptionTemplate): Pick<CaptionTemplate, "places"> {
  const places = (draft.places ?? [])
    .map((form) => ({ ...form, text: form.text.trim() }))
    .filter((form) => form.text !== "");
  return places.length > 0 ? { places } : {};
}

interface TemplateEditorProps {
  /** The saved template; undefined for a new one. */
  template?: CaptionTemplate;
  /** The combined lists, for the preview's photos and their places. */
  data: CombinedData;
  /** With the saved template's ID. */
  onSaved: (id: string) => void;
}

/** Edits one caption template, or a new one, with the placeholders it can use and a preview. */
export function TemplateEditor({ template, data, onSaved }: TemplateEditorProps) {
  const [draft, setDraft] = useState(template ?? NEW);
  const text = useRef<HTMLTextAreaElement>(null);
  const set = (part: Partial<CaptionTemplate>) => setDraft({ ...draft, ...part });
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <TemplateCard template={template} draft={draft} text={text} set={set} onSaved={onSaved} />
      <TemplatePreview template={draft} data={data} />
      <PlaceFormBuilder
        forms={draft.places ?? []}
        data={data}
        onChange={(places) => set({ places })}
      />
      <PlaceholderList
        data={data}
        places={draft.places}
        onInsert={(placeholder) =>
          set({ template: inserted(text.current, draft.template, placeholder) })
        }
      />
    </div>
  );
}

interface TemplateCardProps extends Pick<TemplateEditorProps, "template" | "onSaved"> {
  draft: CaptionTemplate;
  /** The template's text box, which placeholders clicked go in. */
  text: React.RefObject<HTMLTextAreaElement | null>;
  set: (part: Partial<CaptionTemplate>) => void;
}

/** The template's name, platform and text, with Save and Remove. */
function TemplateCard({ template, draft, text, set, onSaved }: TemplateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{template?.name ?? "New caption template"}</CardTitle>
        <CardDescription>
          Put a field in braces, such as <code>{"{camera}"}</code>. Square brackets around a part,
          such as <code>{"[, ƒ {aperture}]"}</code>, leave it out when a field in it is empty, and a
          line whose fields are all empty is left out. <code>{"{placeLocal|place}"}</code> uses the
          first field with a value.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={draft.name}
              placeholder="Instagram"
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Platform, which a post there starts with">
            <PlatformSelect value={draft.platform} onChange={(platform) => set({ platform })} />
          </Field>
        </div>
        <Field label="Template">
          <Textarea
            ref={text}
            rows={10}
            className="font-mono text-sm"
            value={draft.template}
            onChange={(e) => set({ template: e.target.value })}
          />
        </Field>
        <StyleButtons
          field={text}
          text={draft.template}
          onChange={(template) => set({ template })}
        />
        <EntryEditorButtons
          next={templateOf(draft, template)}
          saved={template}
          save={saveCaptionTemplateMutation}
          remove={deleteCaptionTemplateMutation}
          whyNot={whyNot}
          saveLabel="Save template"
          removeLabel="Remove template"
          onSaved={onSaved}
        />
      </CardContent>
    </Card>
  );
}

/** The text with the placeholder put where the cursor is in the field, or at the end. */
function inserted(field: HTMLTextAreaElement | null, text: string, placeholder: string): string {
  if (!field) return text + placeholder;
  return text.slice(0, field.selectionStart) + placeholder + text.slice(field.selectionEnd);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function PlatformSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs"
    >
      <option value="">Any</option>
      {[...socialPlatforms, PHOTO_BOOK_PLATFORM].map((platform) => (
        <option key={platform.id} value={platform.id}>
          {platform.label}
        </option>
      ))}
    </select>
  );
}

/** Why the typed template can't be saved, or "" when it can. */
function whyNot(next: CaptionTemplate): string {
  return next.name === "" ? "Give it a name to save it." : "";
}
