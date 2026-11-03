import type { TagLibraryPreview } from "@/api/tag-library";
import {
  type ChangeToggle,
  ChangeRow,
  Note,
  NoteSection,
  Section,
  changeKey,
  placeName,
} from "@/components/prune-tags/change-list";
import { count } from "@/components/update-data-shared";

interface SectionsProps {
  preview: TagLibraryPreview;
  toggle: ChangeToggle;
}

/** The new tags and renames, which come before the rest of the changes. */
export function NewTagSections({ preview, toggle }: SectionsProps) {
  return (
    <>
      <Section title={`New tags (${preview.newTags.length})`}>
        {preview.newTags.map((t, i) => (
          <ChangeRow key={i} id={changeKey("newTags", i)} reason={t.reason} {...toggle}>
            Make <code>{t.tag}</code> {placeName(t.parent)}
            {t.description && <Note>{t.description}</Note>}
          </ChangeRow>
        ))}
      </Section>
      <Section title={`Renames (${preview.rename.length})`}>
        {preview.rename.map((r, i) => (
          <ChangeRow key={i} id={changeKey("rename", i)} reason={r.reason} {...toggle}>
            Rename <code>{r.tag}</code> to <code>{r.to}</code>
            <Note>On {count(r.photos, "photo")}, with its description and the tags under it.</Note>
          </ChangeRow>
        ))}
      </Section>
    </>
  );
}

/** The new descriptions, each photo's tag changes and the notes, which come after Tag pruning's. */
export function PhotoSections({ preview, toggle }: SectionsProps) {
  return (
    <>
      <Section title={`Descriptions (${preview.describe.length})`}>
        {preview.describe.map((d, i) => (
          <ChangeRow key={i} id={changeKey("describe", i)} reason="" {...toggle}>
            Describe <code>{d.tag}</code>: {d.description}
            <Note>{d.from ? `Now: ${d.from}` : "It has no description yet."}</Note>
          </ChangeRow>
        ))}
      </Section>
      <Section title={`Photo tags (${preview.edits.length})`}>
        {preview.edits.map((e, i) => (
          <ChangeRow key={i} id={changeKey("photos", i)} reason={e.reason} {...toggle}>
            <code>{e.photo}</code>
            <TagDiff add={e.add} remove={e.remove} />
            <Note>Has {e.tags.length > 0 ? e.tags.join(", ") : "no tags"}.</Note>
          </ChangeRow>
        ))}
      </Section>
      <NoteSection notes={preview.notes} toggle={toggle} />
    </>
  );
}

/** The tags a photo gets, in green with a +, and loses, in red with a −. */
function TagDiff({ add, remove }: { add: string[]; remove: string[] }) {
  return (
    <span className="flex flex-wrap gap-1 pt-1 font-mono text-xs">
      {add.map((t) => (
        <span
          key={`+${t}`}
          className="rounded bg-green-500/15 px-1.5 text-green-700 dark:text-green-400"
        >
          +{t}
        </span>
      ))}
      {remove.map((t) => (
        <span key={`-${t}`} className="rounded bg-red-500/15 px-1.5 text-red-700 dark:text-red-400">
          −{t}
        </span>
      ))}
    </span>
  );
}

/** The tags left with fewer photos than a tag should have, once every listed change is made. */
export function FewPhotos({ preview }: { preview: TagLibraryPreview }) {
  if (preview.fewPhotos.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="font-medium">
        {count(preview.fewPhotos.length, "tag")} would have fewer than {preview.minPhotos} photos
      </p>
      <p className="text-muted-foreground text-xs">
        With every change above made. Ask the LLM to add them to more photos, or to remove them with
        a note on their photos.
      </p>
      <ul className="flex flex-wrap gap-1 pt-1 font-mono text-xs">
        {preview.fewPhotos.map((f) => (
          <li key={f.tag} className="bg-muted rounded px-1.5">
            {f.tag} ({f.photos}){f.parent ? ` under ${f.parent}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
