import { RotateCcwIcon } from "lucide-react";
import { SettingsSwitch } from "@/components/settings-switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { type ReEditDraft, savedReEdit } from "@/lib/re-edit";
import { cn } from "@/lib/utils";

interface ReEditCardProps {
  value: ReEditDraft;
  onChange: (value: ReEditDraft) => void;
  /** Saving is under way, so changing it now would not change the file. */
  disabled: boolean;
}

/**
 * Marks the photo to edit again, such as in Lightroom, with why, saved as the JSON's "reEdit". The
 * Gallery and Photos in Flight show the mark, and replacing the image takes it off.
 */
export function ReEditCard({ value, onChange, disabled }: ReEditCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Re-edit</CardTitle>
        <CardDescription>
          A note to yourself to edit the photo again. Saving changes writes it into the JSON&apos;s{" "}
          <code>reEdit</code>, and replacing the image takes it off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset disabled={disabled} className="contents">
          <SettingsSwitch
            id="re-edit-marked"
            config={{
              name: "reEdit",
              label: "Marked for re-editing",
              help: "Shown on the photo in the Gallery and Photos in Flight. The portfolio ignores it.",
            }}
            value={value.marked}
            onChange={(marked) => onChange({ ...value, marked })}
          />
          {value.marked && (
            <div className="flex flex-col gap-2">
              <label htmlFor="re-edit-reason" className="text-sm font-medium">
                Reason
              </label>
              <Textarea
                id="re-edit-reason"
                value={value.reason}
                placeholder="Too warm, crop the sign out, fix the horizon…"
                onChange={(event) => onChange({ ...value, reason: event.target.value })}
              />
            </div>
          )}
        </fieldset>
      </CardContent>
    </Card>
  );
}

/** "Re-edit", with its reason, on a photo marked for re-editing; nothing otherwise. */
export function ReEditMark({ data, className }: { data: unknown; className?: string }) {
  const reEdit = savedReEdit(data);
  if (!reEdit) return null;
  return (
    <span
      title={reEditTitle(reEdit.date)}
      className={cn(
        "flex w-fit items-start gap-1 text-xs font-normal text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <RotateCcwIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>Re-edit{reEdit.reason ? `: ${reEdit.reason}` : ""}</span>
    </span>
  );
}

function reEditTitle(date: string): string {
  return date ? `Marked for re-editing on ${date}` : "Marked for re-editing";
}
