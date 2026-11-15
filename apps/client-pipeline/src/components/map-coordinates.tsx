import { type CopyCoordinates, CoordinatesMenu } from "@portfolio/components/map-coordinates-menu";
import { useRef } from "react";
import { useCopyText } from "@/components/copy-text";
import { copyText } from "@/lib/copy-text";

/**
 * The portfolio map's right-click **Copy coordinates** menu, for the pipeline's maps; it goes
 * inside the `<Map>`. When the browser won't copy (the pipeline opened over plain HTTP, or on a
 * phone), the coordinates open in the copy modal the prompts use, ready to copy by hand.
 */
export function PipelineCoordinatesMenu() {
  const shownText = useRef("");
  const { show, dialog } = useCopyText({ title: "Coordinates", text: () => shownText.current });
  const copy: CopyCoordinates = async (text) => {
    const ok = await copyText(text);
    if (!ok) {
      shownText.current = text;
      show();
    }
    return ok;
  };
  return (
    <>
      <CoordinatesMenu copy={copy} />
      {dialog}
    </>
  );
}
