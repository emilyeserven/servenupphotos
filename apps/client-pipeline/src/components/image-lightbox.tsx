import { XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import type { KeyboardEvent, ReactNode } from "react";
import { FallbackImage } from "@/components/fallback-image";
import { Button } from "@/components/ui/button";
import { offlineSmallUrl } from "@/lib/offline-thumbnails";

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  title: string;
  src: string;
  /** Read out by screen readers, as the visible title doesn't say what's shown. */
  description: string;
  /** Controls shown in the top bar, left of Close, such as a photo's place in its group. */
  toolbar?: ReactNode;
  /** Shown over the image, such as Previous and Next arrows at its sides. */
  overlay?: ReactNode;
  /** A bar under the image, such as buttons that act on the photo shown. */
  footer?: ReactNode;
  /** Called for each key pressed while it's open, such as arrow keys that move to another photo. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Called as it closes, to move focus somewhere other than where it was before it opened. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * A full-window overlay showing one image, scaled down only to fit the window. When the image can't
 * be loaded, such as offline, it shows the photo's Small version from the offline copy instead.
 */
export function ImageLightbox({
  open,
  onClose,
  title,
  src,
  description,
  toolbar,
  overlay,
  footer,
  onKeyDown,
  onCloseAutoFocus,
}: ImageLightboxProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/95" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          onKeyDown={onKeyDown}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="flex items-center gap-4 p-4">
            <Dialog.Title className="flex-1 truncate font-medium">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
            {toolbar}
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <XIcon />
              </Button>
            </Dialog.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
            <FallbackImage
              src={src}
              fallback={offlineSmallUrl(src)}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {overlay}
          </div>
          {footer}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
