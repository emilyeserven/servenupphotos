/** A camera whose name a book's captions write differently, set on the book's Info tab. */
export interface CameraName {
  /** The camera's name as the photo's data has it, after camera overrides. */
  camera: string;
  /** What the book's captions call it instead, such as "X-T5" for "Fujifilm X-T5". */
  name: string;
}

/** The camera's name as the book's captions write it: its name in the book, or else as it is. */
export function bookCameraName(camera: string, names: CameraName[] | undefined): string {
  return names?.find((n) => n.camera === camera)?.name.trim() || camera;
}

/** The book's camera names with camera's set to name, or taken off when name is empty. */
export function withCameraName(
  names: CameraName[] | undefined,
  camera: string,
  name: string,
): CameraName[] {
  const others = (names ?? []).filter((n) => n.camera !== camera);
  return name.trim() === "" ? others : [...others, { camera, name }];
}

/** The photo's fields with its camera written as the book's captions write it. */
export function withBookCameraName(
  fields: Record<string, unknown>,
  names: CameraName[] | undefined,
): Record<string, unknown> {
  if (typeof fields.camera !== "string" || !names?.length) return fields;
  return { ...fields, camera: bookCameraName(fields.camera, names) };
}

/** What the Info tab says beside a camera: how the book's captions write it. */
export function cameraNameNote(camera: string, names: CameraName[] | undefined): string {
  const name = bookCameraName(camera, names);
  return name === camera ? "Written as it is" : `Captions say ${name}`;
}
