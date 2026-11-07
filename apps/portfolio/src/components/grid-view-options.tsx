import { useNavigate } from "@tanstack/react-router";
import { OptionCheckbox, OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import { type GridSize, type SizedView, sizeChoices, sizeParam } from "@/lib/grid-size";

/**
 * The display options of the Grid's tiles and the Lucky page, behind an eye button: how big the tiles are (`?size=`) and whether
 * each shows its title, place and comment (`?info=true`), both kept in the URL so a link keeps
 * them. Natural tiles also come in X-Large. `labelled` writes **Display Options** on the button and
 * lines the flyout up with its right edge, for the Grid's search row.
 */
export function GridViewOptions({
  view,
  size,
  info,
  labelled = false,
}: {
  view: Exclude<SizedView, "table">;
  /** The size the tiles show at. */
  size: GridSize;
  info: boolean;
  /** Writes **Display Options** on the button, for the right end of the Grid's search row. */
  labelled?: boolean;
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
      label={labelled ? "Display Options" : undefined}
      labelled={labelled}
      align={labelled ? "end" : "start"}
      contentClassName="w-auto max-w-[calc(100vw-2rem)]"
      onReset={() => change(undefined, false)}
    >
      {/* Side by side where there's room, so the flyout reads across rather than down. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <OptionChoices
          label="Size"
          choices={sizeChoices(view)}
          value={size}
          onChange={(next) => change(next, info)}
        />
        <div className="sm:pb-1.5">
          <OptionCheckbox
            label="Show info"
            checked={info}
            onChange={(checked) => change(size, checked)}
          />
        </div>
      </div>
    </ViewOptionsButton>
  );
}
