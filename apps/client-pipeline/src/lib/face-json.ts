import { type FaceBox, roundedBox } from "@/lib/face-boxes";
import { FACES } from "@/lib/photo-fields";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NUMBERS = ["x", "y", "width", "height", "blocks"] as const;

/** One area as the photo JSON has it, or undefined when it isn't one. */
function areaFromJson(value: unknown): FaceBox | undefined {
  if (!isRecord(value) || NUMBERS.some((key) => typeof value[key] !== "number")) return undefined;
  const area = value as unknown as FaceBox;
  return roundedBox({
    ...area,
    shape: area.shape === "circle" ? "circle" : undefined,
    edge: area.edge === "blocks" ? "blocks" : undefined,
    rotation: typeof area.rotation === "number" ? area.rotation : undefined,
    keep: area.keep === true,
  });
}

/**
 * The pixelated areas saved in a photo's JSON, or undefined when it has none saved there (a photo
 * pixelated before they were, whose areas are only in R2). Anything that isn't an area is skipped.
 */
export function facesFromJson(data: Record<string, unknown>): FaceBox[] | undefined {
  const value = data[FACES];
  if (!Array.isArray(value)) return undefined;
  return value.map(areaFromJson).filter((area) => area !== undefined);
}

/** data with its pixelated areas set to faces, as the backend takes them; left out when there are none. */
export function withFaces(
  data: Record<string, unknown>,
  faces: FaceBox[],
): Record<string, unknown> {
  const { [FACES]: _old, ...rest } = data;
  return faces.length === 0 ? rest : { ...rest, [FACES]: faces.map(roundedBox) };
}
