import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ExifMutation } from "@/components/add-photo/photo-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useObjectUrl } from "@/hooks/use-object-url";
import { usePendingPhotoStore } from "@/stores/pending-photo";

const JPEG_TYPES = ["image/jpeg", "image/pjpeg"];

function validatePhoto(photo: File | null): string | undefined {
  if (!photo) return "Choose a JPEG photo.";
  if (!JPEG_TYPES.includes(photo.type)) return "Only JPEG photos are supported.";
  return undefined;
}

/** Picks the photo, and analyzes it as soon as a valid one is chosen. */
export function PhotoCard({ extract, onReset }: { extract: ExifMutation; onReset: () => void }) {
  const form = useForm({
    defaultValues: { photo: null as File | null },
    validators: { onSubmit: ({ value }) => validatePhoto(value.photo) },
    onSubmit: async ({ value }) => {
      onReset();
      if (value.photo) await extract.mutateAsync(value.photo).catch(() => {});
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photo</CardTitle>
        <CardDescription>Choosing a photo analyzes it right away.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="photo" validators={{ onChange: ({ value }) => validatePhoto(value) }}>
            {(field) => (
              <PhotoField
                name={field.name}
                error={field.state.meta.errors[0]}
                pending={extract.isPending}
                onBlur={field.handleBlur}
                onChange={(photo) => {
                  extract.reset();
                  onReset();
                  field.handleChange(photo);
                  if (!validatePhoto(photo)) void form.handleSubmit();
                }}
              />
            )}
          </form.Field>
        </form>
      </CardContent>
    </Card>
  );
}

interface PhotoFieldProps {
  name: string;
  error: string | undefined;
  /** The chosen photo is being analyzed, so it can't be swapped yet. */
  pending: boolean;
  onChange: (photo: File | null) => void;
  onBlur: () => void;
}

/** A file picker until a valid photo is chosen, then the photo itself, which opens the picker again when clicked. */
function PhotoField({ name, error, pending, onChange, onBlur }: PhotoFieldProps) {
  const [previewUrl, setPreviewFile] = useObjectUrl();
  const input = useRef<HTMLInputElement>(null);
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const chosen = previewUrl !== null && !error;
  usePendingPhoto((photo) => {
    setPreviewFile(photo);
    onChange(photo);
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Once a photo is chosen, clicking it opens this hidden picker. */}
      <div className={chosen ? "hidden" : "flex flex-col gap-2"}>
        <label htmlFor={name} className="text-sm font-medium">
          JPEG photo
        </label>
        <Input
          ref={input}
          id={name}
          name={name}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={`${hintId} ${errorId}`}
          onBlur={onBlur}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setPreviewFile(file);
            onChange(file);
          }}
        />
      </div>
      {chosen && (
        <PhotoPreview src={previewUrl} disabled={pending} onClick={() => input.current?.click()} />
      )}
      <PhotoHint id={hintId} chosen={chosen} />
      <p id={errorId} className="text-destructive text-sm empty:hidden">
        {error}
      </p>
    </div>
  );
}

/** Picks up a photo chosen with the sidebar's Upload button, as if it had been chosen here. */
function usePendingPhoto(onPhoto: (photo: File) => void) {
  const pending = usePendingPhotoStore((state) => state.photo);
  const take = usePendingPhotoStore((state) => state.take);
  const latest = useRef(onPhoto);
  useEffect(() => {
    latest.current = onPhoto;
  });
  useEffect(() => {
    if (!pending) return;
    // After this render's other effects, so StrictMode's trial unmount can't revoke its preview.
    const timer = setTimeout(() => {
      const photo = take();
      if (photo) latest.current(photo);
    });
    return () => clearTimeout(timer);
  }, [pending, take]);
}

function PhotoHint({ id, chosen }: { id: string; chosen: boolean }) {
  return (
    <p id={id} className="text-muted-foreground text-sm">
      {chosen ? (
        "Click the photo to choose a different one."
      ) : (
        <>
          JPEG only (.jpg or .jpeg). Its resized versions are converted to WEBP when it's uploaded.
          For many photos at once, use{" "}
          <Link to="/bulk-upload" className="text-foreground underline underline-offset-4">
            Bulk Upload
          </Link>
          .
        </>
      )}
    </p>
  );
}

interface PhotoPreviewProps {
  src: string;
  disabled: boolean;
  onClick: () => void;
}

/** The chosen photo as a button that fades and shows a swap icon on hover. */
function PhotoPreview({ src, disabled, onClick }: PhotoPreviewProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Choose a different photo"
      className="group focus-visible:ring-ring/50 relative cursor-pointer overflow-hidden rounded-lg border outline-none focus-visible:ring-[3px] disabled:cursor-wait"
    >
      <img
        src={src}
        alt="The chosen photo"
        className="max-h-80 w-full object-contain transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80 group-disabled:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0">
        <span className="bg-background/80 text-foreground rounded-full p-3 shadow-sm">
          <RefreshCwIcon className="size-6" aria-hidden />
        </span>
      </span>
    </button>
  );
}
