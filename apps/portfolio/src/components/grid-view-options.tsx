import { useNavigate } from "@tanstack/react-router";
import { OptionCheckbox, OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import { type GridSize, type SizedView, sizeChoices, sizeParam } from "@/lib/grid-size";

/**
 * The Grid's display options, behind an eye button: how big the tiles are (`?size=`) and whether
 * each shows its title, place and comment (`?info=true`), both kept in the URL so a link keeps
 * them. Natural tiles also come in X-Large.
 */
export function GridViewOptions({
  view,
  size,
  info,
}: {
  view: Exclude<SizedView, "table">;
  /** The size the tiles show at. */
  size: GridSize;
  info: boolean;
}) {
  const navigate = useNavigate({ from: "/grid" });
  const change = (next: GridSize | undefined, nextInfo: boolean) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        size: next && sizeParam(view, next),
        info: nextInfo || undefined,
      }),
      replace: true,
    });
  return (
    <ViewOptionsButton contentClassName="w-80" onReset={() => change(undefined, false)}>
      <OptionChoices
        label="Size"
        choices={sizeChoices(view)}
        value={size}
        onChange={(next) => change(next, info)}
      />
      <OptionCheckbox
        label="Show info"
        checked={info}
        onChange={(checked) => change(size, checked)}
      />
    </ViewOptionsButton>
  );
}
