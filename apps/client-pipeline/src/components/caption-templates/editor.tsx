import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  type CaptionTemplate,
  captionTemplateId,
  deleteCaptionTemplateMutation,
  saveCaptionTemplateMutation,
} from "@/api/captions";
import type { CombinedData } from "@/api/photos";
import { PlaceholderList } from "@/components/caption-templates/placeholder-list";
import { TemplatePreview } from "@/components/caption-templates/preview";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STARTER_TEMPLATE } from "@/lib/caption-template";
import { canonicalJson } from "@/lib/combined";
import { PHOTO_BOOK_PLATFORM, socialPlatforms } from "@/lib/social-posts";

const NEW: CaptionTemplate = { id: "", name: "", platform: "", template: STARTER_TEMPLATE };

/** The template the typed one saves, keeping a saved template's ID. */
function templateOf(draft: CaptionTemplate, saved?: CaptionTemplate): CaptionTemplate {
  return {
    id: saved?.id ?? captionTemplateId(draft.name),
    name: draft.name.trim(),
    platform: draft.platform,
    template: draft.template.trimEnd(),
  };
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
      <Card>
        <CardHeader>
          <CardTitle>{template?.name ?? "New caption template"}</CardTitle>
          <CardDescription>
            Put a field in braces, such as <code>{"{camera}"}</code>. Square brackets around a part,
            such as <code>{"[, ƒ {aperture}]"}</code>, leave it out when a field in it is empty, and
            a line whose fields are all empty is left out. <code>{"{placeLocal|place}"}</code> uses
            the first field with a value.
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
          <EditorButtons next={templateOf(draft, template)} saved={template} onSaved={onSaved} />
        </CardContent>
      </Card>
      <TemplatePreview template={draft.template} data={data} />
      <PlaceholderList
        onInsert={(placeholder) =>
          set({ template: inserted(text.current, draft.template, placeholder) })
        }
      />
    </div>
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

interface ButtonsProps {
  next: CaptionTemplate;
  saved?: CaptionTemplate;
  onSaved: (id: string) => void;
}

/** Save, and Remove for a saved template, each saving a change waiting for Commit. */
function EditorButtons({ next, saved, onSaved }: ButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton next={next} saved={saved} onSaved={onSaved} />
      {saved && <RemoveButton id={saved.id} />}
    </div>
  );
}

/** Why the typed template can't be saved, or "" when it can. */
function whyNot(next: CaptionTemplate): string {
  return next.name === "" ? "Give it a name to save it." : "";
}

/** Whether there's nothing to save: no name, or what's saved already. */
function cantSave(next: CaptionTemplate, saved?: CaptionTemplate): boolean {
  return whyNot(next) !== "" || canonicalJson(next) === canonicalJson(saved ?? null);
}

function SaveButton({ next, saved, onSaved }: ButtonsProps) {
  const save = useMutation(saveCaptionTemplateMutation);
  return (
    <>
      <Button
        disabled={cantSave(next, saved) || save.isPending}
        onClick={() => save.mutate(next, { onSuccess: () => onSaved(next.id) })}
      >
        <Busy busy={save.isPending} />
        {saved ? "Save changes" : "Save template"}
      </Button>
      <SaveNote error={save.error} why={whyNot(next)} />
    </>
  );
}

function RemoveButton({ id }: { id: string }) {
  const remove = useMutation(deleteCaptionTemplateMutation);
  return (
    <RemoveEntryButton
      label="Remove template"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}
