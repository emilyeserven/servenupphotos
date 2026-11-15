import type { ReactNode } from "react";

interface DetailsPhotoPreviewProps {
  /** The photo's Small version; without one, the fields show on their own. */
  imageUrl?: string;
  /** What screen readers say the image shows. */
  alt: string;
  /** The fields the photo sits beside, such as Title and Date taken. */
  children: ReactNode;
}

/**
 * The photo's Small version at the right of the fields beside it, so the photo being described stays
 * in view; on a phone it sits above them.
 */
export function DetailsPhotoPreview({ imageUrl, alt, children }: DetailsPhotoPreviewProps) {
  if (!imageUrl) return <>{children}</>;
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        className="order-first h-40 w-auto max-w-full self-start rounded-md border object-contain sm:order-none sm:max-w-64"
      />
    </div>
  );
}
