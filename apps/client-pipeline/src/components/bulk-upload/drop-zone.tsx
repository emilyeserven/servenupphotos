import { ImagesIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  /** Called with the photos chosen or dropped, in their order. */
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** Take one photo rather than many; the first dropped is used. */
  single?: boolean;
}

const TEXT = {
  many: {
    title: "Drop JPEG photos here, or click to choose them",
    hint: "Each one is analyzed, uploaded to R2 and added to the batch in turn.",
  },
  single: {
    title: "Drop a JPEG photo here, or click to choose it",
    hint: "It opens on the Photo page, where you set its details before uploading it.",
  },
};

/** A large target to drop photos on, which also opens the file picker, for many photos at once or one. */
export function DropZone({ onFiles, disabled = false, single = false }: DropZoneProps) {
  const text = TEXT[single ? "single" : "many"];
  const [over, setOver] = useState(false);
  const take = (files: FileList | null) => {
    if (files && files.length > 0) onFiles([...files]);
  };

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
        "focus-within:ring-ring/50 hover:bg-muted/40 focus-within:ring-[3px]",
        over && "border-primary bg-muted/60",
        disabled && "pointer-events-none opacity-50",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      <ImagesIcon className="text-muted-foreground size-8" aria-hidden />
      <span className="font-medium">{text.title}</span>
      <span className="text-muted-foreground text-sm">{text.hint}</span>
      <input
        type="file"
        multiple={!single}
        accept="image/jpeg,.jpg,.jpeg"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          take(event.target.files);
          // Lets the same photos be chosen again.
          event.target.value = "";
        }}
      />
    </label>
  );
}
