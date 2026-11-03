import { CheckIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { photoShareUrl } from "@/lib/photo-share";

/**
 * The photo viewer's Copy link button: copies the link to the photo's own page, which shows the
 * photo when shared on social media or in a chat and opens it on this page with these settings,
 * then shows a check for a moment.
 */
export function CopyPhotoLinkButton({ id }: { id: number }) {
  const [justCopied, setJustCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={justCopied ? "Link copied" : "Copy link"}
      title="Copy a link that shows this photo when shared"
      onClick={() => {
        void navigator.clipboard.writeText(photoShareUrl(id)).then(() => {
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        });
      }}
      className="text-white hover:bg-white/10 hover:text-white"
    >
      {justCopied ? <CheckIcon /> : <LinkIcon />}
    </Button>
  );
}
