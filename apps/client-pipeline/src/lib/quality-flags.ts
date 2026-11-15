import { NOTES } from "@/lib/photo-fields";
import { type ReEdit, savedReEdit, withReEdit } from "@/lib/re-edit";

/** Why a photo failed a Quality Check: what its re-edit mark says, and the note to add. */
export interface QualityFlag {
  /** The re-edit reason, short, such as "Crop to 16:9" or "Pixelate the license plate". */
  reason: string;
  /** The photographer note saying what failed, added after any notes the photo has. */
  note: string;
}

/**
 * The re-edit mark the photo gets for flag: marked with flag's reason, keeping the day it was first
 * marked, and joining a reason it has already with "; " unless that already says it.
 */
export function flaggedReEdit(data: Record<string, unknown>, flag: QualityFlag): ReEdit {
  const saved = savedReEdit(data)?.reason.trim() ?? "";
  const reason = flag.reason.trim();
  const joined = !saved || saved.includes(reason) ? saved || reason : `${saved}; ${reason}`;
  return withReEdit(data, { marked: true, reason: joined }).reEdit as ReEdit;
}

/**
 * The photo's notes with flag's note added after the ones it has, following a blank line, as Tag
 * pruning adds them; unchanged when they already have it.
 */
export function flaggedNotes(data: Record<string, unknown>, flag: QualityFlag): string {
  const saved = typeof data[NOTES] === "string" ? (data[NOTES] as string).trim() : "";
  const note = flag.note.trim();
  if (!note || saved.includes(note)) return saved;
  return saved ? `${saved}\n\n${note}` : note;
}

/** Whether the photo already has flag's re-edit reason and note, so flagging it changes nothing. */
export function alreadyFlagged(data: Record<string, unknown>, flag: QualityFlag): boolean {
  const notes = typeof data[NOTES] === "string" ? (data[NOTES] as string).trim() : "";
  return (
    flaggedReEdit(data, flag).reason === savedReEdit(data)?.reason.trim() &&
    flaggedNotes(data, flag) === notes
  );
}
