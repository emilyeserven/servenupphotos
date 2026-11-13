import { Field } from "@/components/graph-presets/editor-parts";
import { Input } from "@/components/ui/input";

/** How long a preset's description can be, as the backend allows. */
const MAX_LENGTH = 200;

/**
 * A preset's **Description**: the one line under its name in the Graph page's Presets picker,
 * saying what the graph shows. Left empty, the picker words one from its settings instead.
 */
export function DescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (description: string) => void;
}) {
  return (
    <Field label="Description">
      <Input
        value={value}
        maxLength={MAX_LENGTH}
        placeholder="How wide the lens was open, one dot for every photo"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-xs font-normal text-muted-foreground">
        One line under its name in the Graph page's Presets. Left empty, it says the graph's type
        and axes, such as Heatmap of Month by Year.
      </span>
    </Field>
  );
}
