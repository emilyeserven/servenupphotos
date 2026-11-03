import type { TagLibraryPreview } from "@/api/tag-library";
import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { count } from "@/components/update-data-shared";
import { tagLibraryFollowUpPrompt } from "@/lib/tag-library-prompt";

/**
 * The tags left with fewer photos or subtags than a tag should have, once every listed change is
 * made, and a button that copies a follow-up prompt asking the LLM to fix them in a new answer.
 */
export function FewWarnings({ preview }: { preview: TagLibraryPreview }) {
  const { fewPhotos, fewSubtags, minPhotos } = preview;
  if (fewPhotos.length + fewSubtags.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
      <FewList
        title={`${count(fewPhotos.length, "tag")} would have fewer than ${minPhotos} photos`}
        items={fewPhotos.map(
          (f) => `${f.tag} (${f.photos})${f.parent ? ` under ${f.parent}` : ""}`,
        )}
      />
      <FewList
        title={`${count(fewSubtags.length, "tag")} would have fewer than ${minPhotos} subtags`}
        items={fewSubtags.map((f) => `${f.tag}: ${f.subtags.join(", ")}`)}
      />
      <p className="text-muted-foreground pt-1 text-xs">
        With every change above made. Copy the follow-up prompt into the same chat: it asks the LLM
        to fix each one (adding a tag to more photos, or removing it with a note on its photos, and
        adding subtags or merging them into their parent) and to send its whole answer again. Paste
        the new answer above and review the changes again.
      </p>
      <div className="pt-2">
        <CopyPromptButton
          label="Copy the follow-up prompt"
          disabled={false}
          prompt={() => tagLibraryFollowUpPrompt(fewPhotos, fewSubtags, minPhotos)}
        />
      </div>
    </div>
  );
}

/** One kind of warning: its title and each tag it's about, or nothing when there are none. */
function FewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="font-medium">{title}</p>
      <ul className="flex flex-wrap gap-1 pb-1 font-mono text-xs">
        {items.map((item) => (
          <li key={item} className="bg-muted rounded px-1.5">
            {item}
          </li>
        ))}
      </ul>
    </>
  );
}
