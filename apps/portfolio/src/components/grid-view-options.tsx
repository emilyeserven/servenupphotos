import { useNavigate } from "@tanstack/react-router";
import {
  OptionCheckbox,
  OptionChoices,
  OptionGroup,
  ViewOptionsButton,
} from "@/components/view-options-button";
import { type GridSize, type SizedView, sizeChoices, sizeParam } from "@/lib/grid-size";

/** The display options as the flyout sets them. */
interface TileOptions {
  size: GridSize | undefined;
  info: boolean;
  ordered: boolean;
}

/**
 * The display options of the Grid's tiles and the Lucky page, behind a **Display Options** button: how big the tiles are (`?size=`) and whether
 * each shows its title, place and comment (`?info=true`), both kept in the URL so a link keeps
 * them. Natural tiles also come in X-Large. When `ordered` is given (the Grid's Natural tiles),
 * **Keep the order** sets whether the rows keep the photos strictly in the sort's order
 * (`?ordered=true`).
 */
export function GridViewOptions({
  view,
  size,
  info,
  ordered,
  align = "start",
}: {
  view: Exclude<SizedView, "table">;
  /** The size the tiles show at. */
  size: GridSize;
  info: boolean;
  /** Whether Natural rows keep the sort's order, or left out where there's no such choice. */
  ordered?: boolean;
  /** Which edge of the button the flyout lines up with: "end" at the right end of the Grid's search row. */
  align?: "start" | "end";
}) {
  const navigate = useNavigate();
  const current: TileOptions = { size, info, ordered: ordered ?? false };
  const change = (patch: Partial<TileOptions>) => {
    const next = { ...current, ...patch };
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        size: next.size && sizeParam(view, next.size),
        info: next.info || undefined,
        ordered: next.ordered || undefined,
      }),
      replace: true,
    });
  };
  return (
    <ViewOptionsButton
      align={align}
      onReset={() => change({ size: undefined, info: false, ordered: false })}
      choices={
        <OptionChoices
          label="Size"
          choices={sizeChoices(view)}
          value={size}
          onChange={(next) => change({ size: next })}
        />
      }
      checks={
        <>
          <OptionGroup label="Each photo">
            <OptionCheckbox
              label="Show info"
              checked={info}
              onChange={(checked) => change({ info: checked })}
            />
          </OptionGroup>
          {ordered !== undefined && (
            <OptionGroup label="Rows">
              <OptionCheckbox
                label="Keep the order"
                checked={ordered}
                onChange={(checked) => change({ ordered: checked })}
              />
            </OptionGroup>
          )}
        </>
      }
    />
  );
}
