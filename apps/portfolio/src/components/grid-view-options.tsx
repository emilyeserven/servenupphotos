import { useNavigate } from "@tanstack/react-router";
import { OptionCheckbox, OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import { type GridSize, sizeChoices, squareSize } from "@/lib/grid-size";

/**
 * The Grid's display options, behind an eye button: how big the tiles are (`?size=`) and whether
 * each shows its title, place and comment (`?info=true`), both kept in the URL so a link keeps
 * them. Natural tiles can also be Small.
 */
export function GridViewOptions({
  natural,
  size,
  info,
}: {
  natural: boolean;
  size: GridSize;
  info: boolean;
}) {
  const navigate = useNavigate({ from: "/grid" });
  const change = (options: { size?: GridSize; info?: true }) =>
    void navigate({ search: (prev) => ({ ...prev, ...urlOptions(options) }), replace: true });
  return (
    <ViewOptionsButton contentClassName="w-80" onReset={() => change({ size: "medium" })}>
      <OptionChoices
        label="Size"
        choices={sizeChoices(natural)}
        value={natural ? size : squareSize(size)}
        onChange={(next) => change({ size: next, info: info || undefined })}
      />
      <OptionCheckbox
        label="Show info"
        checked={info}
        onChange={(checked) => change({ size, info: checked || undefined })}
      />
    </ViewOptionsButton>
  );
}

/** The options as the URL keeps them, leaving out Medium and hidden info. */
function urlOptions({ size, info }: { size?: GridSize; info?: true }) {
  return { size: size === "medium" ? undefined : size, info };
}
