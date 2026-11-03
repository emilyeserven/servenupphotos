import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { type CaptionTemplate, captionTemplates } from "@/api/captions";
import type { CombinedData } from "@/api/photos";
import { TemplateEditor } from "@/components/caption-templates/editor";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { platformLabel } from "@/lib/social-posts";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** The Caption Templates page: the captions the Photo page's Generate writes for a social media post. */
export function CaptionTemplatesPage() {
  return (
    <Page
      wide
      title="Caption Templates"
      description="Captions for social media posts with placeholders for the photo's fields, such as {title} or {camera}. Generate on the Photo page fills one in for a post. Each template is one JSON file, combined into CAPTIONS.json."
    >
      <GitHubGate>{() => <Templates />}</GitHubGate>
    </Page>
  );
}

function Templates() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the caption templates from GitHub…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <TemplateChooser data={combined.data} />;
}

/** The chosen template's ID, or "" for a new one. */
const NEW_TEMPLATE = "";

/** The templates listed on the left, and the chosen one, or a new one, edited on the right. */
function TemplateChooser({ data }: { data: CombinedData }) {
  const templates = captionTemplates(data);
  const [chosen, setChosen] = useState<string>(() => templates[0]?.id ?? NEW_TEMPLATE);
  const template = templates.find((t) => t.id === chosen);
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
      <TemplateList templates={templates} chosen={template?.id} onChoose={setChosen} />
      <TemplateEditor
        key={template?.id ?? NEW_TEMPLATE}
        template={template}
        data={data}
        onSaved={setChosen}
      />
    </div>
  );
}

interface TemplateListProps {
  templates: CaptionTemplate[];
  chosen?: string;
  onChoose: (id: string) => void;
}

function TemplateList({ templates, chosen, onChoose }: TemplateListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates</CardTitle>
        <CardDescription>With the platform each is for.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {templates.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onChoose(template.id)}
            aria-current={template.id === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              template.id === chosen && "bg-muted font-medium",
            )}
          >
            <span className="min-w-0 truncate">{template.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {template.platform ? platformLabel(template.platform) : "Any"}
            </span>
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 self-start"
          disabled={chosen === undefined}
          onClick={() => onChoose(NEW_TEMPLATE)}
        >
          <PlusIcon aria-hidden />
          New template
        </Button>
      </CardContent>
    </Card>
  );
}
