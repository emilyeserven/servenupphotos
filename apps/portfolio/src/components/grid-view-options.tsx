import { useNavigate } from "@tanstack/react-router";
import {
  OptionCheckbox,
  OptionChoices,
  OptionGroup,
  ViewOptionsButton,
} from "@/components/view-options-button";
import { type GridSize, type SizedView, sizeChoices } from "@/lib/grid-size";
import { optionsSearch, type TileOptions } from "@/lib/tile-options";

/** Distance's display options: grouping the tiles by distance, and each tile's distance on it. */
type DistanceOptions = Pick<TileOptions, "bands" | "distances">;

/** Distance's display options when they're off, as they start. */
const NO_DISTANCE: DistanceOptions = { bands: false, distances: false };

/**
 * The display options of the Grid's tiles and the Lucky page, behind a **Display Options** button: how big the tiles are (`?size=`) and whether
 * each shows its title, place and comment (`?info=true`), both kept in the URL so a link keeps
 * them. Natural tiles also come in X-Large. When `ordered` is given (the Grid's Natural tiles),
 * **Keep the order** sets whether the rows keep the photos strictly in the sort's order
 * (on by default; `?ordered=false` when it's off). When `distance` is given (the Grid sorted by
 * Distance), **Group by distance** splits the tiles into groups of nearby distances (`?bands=true`)
 * and **Show distance** puts each photo's distance on its tile (`?distances=true`).
 */
export function GridViewOptions({
  view,
  size,
  info,
  ordered,
  distance,
  align = "start",
}: {
  view: Exclude<SizedView, "table">;
  /** The size the tiles show at. */
  size: GridSize;
  info: boolean;
  /** Whether Natural rows keep the sort's order, or left out where there's no such choice. */
  ordered?: boolean;
  /** Distance's options, or left out unless the Grid is sorted by Distance. */
  distance?: DistanceOptions;
  /** Which edge of the button the flyout lines up with: "end" at the right end of the Grid's search row. */
  align?: "start" | "end";
}) {
  const navigate = useNavigate();
  const current: TileOptions = {
    size,
    info,
    ordered: ordered ?? true,
    ...(distance ?? NO_DISTANCE),
  };
  const change = (patch: Partial<TileOptions>) => {
    const next = { ...current, ...patch };
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...optionsSearch(view, next) }),
      replace: true,
    });
  };
  return (
    <ViewOptionsButton
      align={align}
      onReset={() => change({ size: undefined, info: false, ordered: true, ...NO_DISTANCE })}
      choices={
        <OptionChoices
          label="Size"
          choices={sizeChoices(view)}
          value={size}
          onChange={(next) => change({ size: next })}
        />
      }
      checks={<TileChecks info={info} ordered={ordered} distance={distance} onChange={change} />}
    />
  );
}

/**
 * The flyout's checkboxes: **Show info**, then **Keep the order** and **Group by distance** and **Show distance**
 * where they apply (left out when undefined).
 */
function TileChecks({
  info,
  ordered,
  distance,
  onChange,
}: {
  info: boolean;
  ordered?: boolean;
  distance?: DistanceOptions;
  onChange: (patch: Partial<TileOptions>) => void;
}) {
  return (
    <>
      <OptionGroup label="Each photo">
        <OptionCheckbox
          label="Show info"
          checked={info}
          onChange={(checked) => onChange({ info: checked })}
        />
      </OptionGroup>
      {ordered !== undefined && (
        <OptionGroup label="Rows">
          <OptionCheckbox
            label="Keep the order"
            checked={ordered}
            onChange={(checked) => onChange({ ordered: checked })}
          />
        </OptionGroup>
      )}
      {distance && (
        <OptionGroup label="Distance">
          <OptionCheckbox
            label="Group by distance"
            checked={distance.bands}
            onChange={(checked) => onChange({ bands: checked })}
          />
          <OptionCheckbox
            label="Show distance"
            checked={distance.distances}
            onChange={(checked) => onChange({ distances: checked })}
          />
        </OptionGroup>
      )}
    </>
  );
}
