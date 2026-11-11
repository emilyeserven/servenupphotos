import { useMutation } from "@tanstack/react-query";
import { ImagePlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { uploadBioPortraitMutation } from "@/api/bio";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { BioPortrait } from "@/lib/bio";

/**
 * The button that uploads self-portraits, one or more at once, each put in R2 right away as its two
 * WEBP versions and handed to onUploaded to add to the bio, in the order they were chosen.
 */
export function PortraitUpload({ onUploaded }: { onUploaded: (portrait: BioPortrait) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation(uploadBioPortraitMutation);
  const [left, setLeft] = useState(0);
  const uploadAll = async (files: File[]) => {
    setLeft(files.length);
    for (const file of files) {
      try {
        const uploaded = await upload.mutateAsync(file);
        onUploaded({ ...uploaded, alt: "" });
      } catch {
        // The error shows under the button; the other files still go up.
      }
      setLeft((n) => n - 1);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Self-portraits to upload"
        onChange={(event) => {
          void uploadAll([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <Button variant="outline" disabled={left > 0} onClick={() => input.current?.click()}>
        {left > 0 ? <Spinner /> : <ImagePlusIcon aria-hidden />}
        {left > 0 ? `Uploading ${left}…` : "Upload self-portraits"}
      </Button>
      {upload.isError && <p className="text-destructive text-xs">{upload.error.message}</p>}
    </div>
  );
}
