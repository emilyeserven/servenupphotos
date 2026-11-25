import { Choices } from "@/components/photo-book/layout-fields";
import type { CustomLayout, PageSide } from "@/lib/photo-book";

/** How a layout draws left-hand pages, by name, in the order the Layouts tab offers them. */
const LEFT_PAGES: [NonNullable<CustomLayout["leftPages"]>, string][] = [
  ["mirror", "Mirrored"],
  ["same", "Same"],
  ["own", "Own settings"],
];

interface LeftPagesFieldProps {
  layout: CustomLayout;
  onLeftPages: (what: NonNullable<CustomLayout["leftPages"]>) => void;
  /** Which side's settings the fields below change, when left-hand pages have their own. */
  editing: PageSide;
  onEditing: (side: PageSide) => void;
}

/**
 * How the layout looks on left-hand (even) pages: mirrored, the same as on right-hand (odd) ones,
 * or its own settings, and then which side's settings to change.
 */
export function LeftPagesField(props: LeftPagesFieldProps) {
  const { layout, onLeftPages, editing, onEditing } = props;
  const own = layout.leftPages === "own";
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <Choices
        label="Left-hand pages"
        value={layout.leftPages ?? "same"}
        options={LEFT_PAGES}
        onChange={onLeftPages}
      />
      <p className="text-muted-foreground text-xs">
        Even pages sit on the left of the open book. Mirrored turns the text to the other side.
      </p>
      {own && (
        <Choices
          label="Settings for"
          value={editing}
          options={[
            ["right", "Right pages"],
            ["left", "Left pages"],
          ]}
          onChange={onEditing}
        />
      )}
    </div>
  );
}
