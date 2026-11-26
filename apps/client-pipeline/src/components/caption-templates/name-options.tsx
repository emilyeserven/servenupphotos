import type { CaptionTemplate } from "@/api/captions";
import { AddRowButton, RemoveRowButton } from "@/components/caption-templates/row-buttons";
import { SectionTitle } from "@/components/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type NameOptionsPart = Pick<CaptionTemplate, "noBreak" | "stateAbbreviations">;

interface NameOptionsProps {
  template: NameOptionsPart;
  onChange: (part: NameOptionsPart) => void;
}

/**
 * How the template writes names: **Abbreviate US states**, such as CA for California, and
 * **Never break**, the values a line never breaks inside, such as San Francisco.
 */
export function NameOptions({ template, onChange }: NameOptionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Names</CardTitle>
        <CardDescription>
          How this template writes states, and names it keeps on one line in Photo Book captions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4 shrink-0"
            checked={template.stateAbbreviations ?? false}
            onChange={(e) => onChange({ stateAbbreviations: e.target.checked })}
          />
          Abbreviate US states, such as CA for California
        </label>
        <NeverBreak values={template.noBreak ?? []} onChange={(noBreak) => onChange({ noBreak })} />
      </CardContent>
    </Card>
  );
}

interface NeverBreakProps {
  values: string[];
  onChange: (values: string[]) => void;
}

/** The values a line never breaks inside, each a text box with a remove button, and **Add a value**. */
function NeverBreak({ values, onChange }: NeverBreakProps) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>Never break</SectionTitle>
      <p className="text-muted-foreground text-xs">
        Wherever one of these shows up in a caption, it stays on one line, such as San Francisco. To
        keep a part of the template together instead, select it and press Keep together.
      </p>
      {values.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="w-64"
            value={value}
            placeholder="San Francisco"
            aria-label="Value that never breaks"
            onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <RemoveRowButton
            label="Remove this value"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <AddRowButton label="Add a value" onClick={() => onChange([...values, ""])} />
    </div>
  );
}
