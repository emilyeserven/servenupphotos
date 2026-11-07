import { LockIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface PhotoNotesFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * The photo's photographer-only notes: plain text for the pipeline, such as what the photo shows that
 * isn't a tag, saved as the JSON's "notes". The portfolio's build leaves them out.
 */
export function PhotoNotesField({ value, disabled, onChange }: PhotoNotesFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="photo-notes" className="flex items-center gap-1.5 text-sm font-medium">
        <LockIcon className="text-muted-foreground size-3.5" aria-hidden />
        Photographer notes
      </label>
      <Textarea
        id="photo-notes"
        aria-describedby="photo-notes-hint"
        placeholder="Only for you: what's in the photo, ideas, why a tag was left off…"
        className="max-h-72 min-h-20"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id="photo-notes-hint" className="text-muted-foreground text-xs">
        Only shown in the pipeline. The portfolio never shows or builds them in.
      </p>
    </div>
  );
}
