import { useNavigate } from "@tanstack/react-router";
import {
  OptionCheckbox,
  OptionChoices,
  OptionGroup,
  ViewOptionsButton,
} from "@/components/view-options-button";
import { type GridSize, type SizedView, sizeChoices, sizeParam } from "@/lib/grid-size";

/**
 * The display options of the Grid's tiles and the Lucky page, behind a **Display Options** button: how big the tiles are (`?size=`) and whether
 * each shows its title, place and comment (`?info=true`), both kept in the URL so a link keeps
 * them. Natural tiles also come in X-Large.
 */
export function GridViewOptions({
  view,
  size,
  info,
  align = "start",
}: {
  view: Exclude<SizedView, "table">;
  /** The size the tiles show at. */
  size: GridSize;
  info: boolean;
  /** Which edge of the button the flyout lines up with: "end" at the right end of the Grid's search row. */
  align?: "start" | "end";
}) {
  const navigate = useNavigate();
  const change = (next: GridSize | undefined, nextInfo: boolean) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        size: next && sizeParam(view, next),
        info: nextInfo || undefined,
      }),
      replace: true,
    });
  return (
    <ViewOptionsButton
      align={align}
      onReset={() => change(undefined, false)}
      choices={
        <OptionChoices
          label="Size"
          choices={sizeChoices(view)}
          value={size}
          onChange={(next) => change(next, info)}
        />
      }
      checks={
        <OptionGroup label="Each photo">
          <OptionCheckbox
            label="Show info"
            checked={info}
            onChange={(checked) => change(size, checked)}
          />
        </OptionGroup>
      }
    />
  );
}
