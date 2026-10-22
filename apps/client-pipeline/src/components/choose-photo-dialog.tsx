import { useNavigate } from "@tanstack/react-router";
import { ImagesIcon, RefreshCwIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DropZone } from "@/components/bulk-upload/drop-zone";
import { SavedPhotoPicker } from "@/components/saved-photo-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePendingPhotoStore } from "@/stores/pending-photo";

type Source = "upload" | "saved";

interface ChoosePhotoDialogProps {
  /** Which tab it opens on. */
  initial: Source;
  /** The button that opens it. */
  trigger: ReactNode;
}

/**
 * A modal to work on another photo: upload a new one from this computer, which the Photo page
 * analyzes, or pick a saved one to open on Edit Photo.
 */
function ChoosePhotoDialog({ initial, trigger }: ChoosePhotoDialogProps) {
  const [open, setOpen] = useState(false);
  const choose = usePendingPhotoStore((state) => state.choose);
  const navigate = useNavigate();
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a photo</DialogTitle>
          <DialogDescription>
            Upload a new photo, or pick one that's already saved to edit it.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={initial}>
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="saved">Saved photos</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <DropZone
              single
              onFiles={([photo]) => {
                if (!photo) return;
                choose(photo);
                // From Edit Photo, back to adding a photo.
                void navigate({ to: "/exif" });
                close();
              }}
            />
          </TabsContent>
          <TabsContent value="saved">
            <SavedPhotoPicker onPicked={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Next to the Photo page's title once a photo is chosen: opens the modal to choose another. */
export function ChangePhotoButton() {
  return (
    <ChoosePhotoDialog
      initial="upload"
      trigger={
        <Button variant="outline" size="sm">
          <RefreshCwIcon aria-hidden />
          Choose another photo
        </Button>
      }
    />
  );
}

/** Beside the Photo page's upload card until a photo is chosen: opens the modal on the saved photos. */
export function SavedPhotoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved photo</CardTitle>
        <CardDescription>
          Or work on a photo that's already in the batch or the portfolio, on Edit Photo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChoosePhotoDialog
          initial="saved"
          trigger={
            <Button variant="outline">
              <ImagesIcon aria-hidden />
              Choose a saved photo
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
