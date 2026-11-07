import { Link } from "@tanstack/react-router";
import { ImportIcon } from "lucide-react";
import { AlbumTreeCard } from "@/components/lightroom-albums/album-tree";
import { NextUpCard } from "@/components/lightroom-albums/next-up";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

/**
 * The Lightroom Albums page: the next albums to work on, and every album as a tree or a board with its stage and
 * notes, only in this browser. Getting the list from Lightroom is on Lightroom Albums › Import.
 */
export function LightroomAlbumsPage() {
  return (
    <Page
      wide
      title="Lightroom Albums"
      description="Your Lightroom folders and albums, with a stage and notes on each album. It's all kept in this browser only: nothing here goes to the backend or GitHub."
      action={
        <Button variant="outline" asChild>
          <Link to="/lightroom-albums/import">
            <ImportIcon />
            Import or export
          </Link>
        </Button>
      }
    >
      <NextUpCard />
      <AlbumTreeCard />
    </Page>
  );
}
