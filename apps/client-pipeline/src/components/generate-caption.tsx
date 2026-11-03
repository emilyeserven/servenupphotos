import { Link } from "@tanstack/react-router";
import { WandSparklesIcon } from "lucide-react";
import { useState } from "react";
import { type CaptionTemplate, captionTemplates } from "@/api/captions";
import { Button } from "@/components/ui/button";
import { captionLists, captionValues, fillCaption } from "@/lib/caption-template";
import { parseHashtags, type SocialPostDraft } from "@/lib/social-posts";
import { useCombinedData } from "@/stores/combined-data";

interface GenerateCaptionProps {
  post: SocialPostDraft;
  /** The photo's JSON as it's being edited, which the caption is made from. */
  photo: Record<string, unknown>;
  disabled: boolean;
  onGenerate: (caption: string) => void;
}

/** The template a post starts with: the first one for its platform, or else the first one for any, or else the first. */
function startingTemplate(templates: CaptionTemplate[], platform: string) {
  const forPlatform = (p: string) => templates.find((t) => t.platform === p);
  return forPlatform(platform) ?? forPlatform("") ?? templates[0];
}

/**
 * A caption template to pick and a Generate button that writes the caption it makes from the
 * photo's data, asking first when the caption already has text; a link to the Caption Templates
 * page when there are none.
 */
export function GenerateCaption({ post, photo, disabled, onGenerate }: GenerateCaptionProps) {
  const { data } = useCombinedData();
  const templates = captionTemplates(data);
  const [picked, setPicked] = useState<string | null>(null);
  const template =
    templates.find((t) => t.id === picked) ?? startingTemplate(templates, post.platform);
  if (!template) return <NoTemplates />;
  const generate = () => {
    const values = captionValues(photo, captionLists(data), parseHashtags(post.hashtags));
    const caption = fillCaption(template.template, values);
    if (post.caption.trim() && !window.confirm("Replace the caption with the generated one?"))
      return;
    onGenerate(caption);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Caption template"
        value={template.id}
        disabled={disabled}
        onChange={(event) => setPicked(event.target.value)}
        className="border-input dark:bg-input/30 h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm shadow-xs"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button variant="outline" size="sm" disabled={disabled} onClick={generate}>
        <WandSparklesIcon />
        Generate
      </Button>
    </div>
  );
}

function NoTemplates() {
  return (
    <p className="text-muted-foreground text-xs">
      Set up a{" "}
      <Link to="/caption-templates" className="underline underline-offset-4">
        caption template
      </Link>{" "}
      to generate captions from the photo&apos;s data.
    </p>
  );
}
