import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { type ViewerLikes, viewerLikes, importedText } from "@/api/viewer-likes";
import type { CombinedData } from "@/api/photos";
import { ViewerImporter } from "@/components/viewer-likes/importer";
import { MostLiked, photoTitles } from "@/components/viewer-likes/most-liked";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** The User Likes page: the lists of liked photos people sent from the portfolio's My Likes page. */
export function ViewerLikesPage() {
  return (
    <Page
      wide
      title="User Likes"
      description="The photos people liked on the portfolio, from the list My Likes' “Send to photographer” makes. Each person is one JSON file, combined into LIKES.json, and importing a person's list again replaces their old one, so nobody's likes count twice."
    >
      <GitHubGate>{() => <Likes />}</GitHubGate>
    </Page>
  );
}

function Likes() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and user likes from GitHub…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <ViewerChooser data={combined.data} />;
}

/** The chosen person's ID, or "" for a new one. */
const NEW_VIEWER = "";

/** The people listed on the left and the chosen one, or a new one, imported on the right, with the totals under them. */
function ViewerChooser({ data }: { data: CombinedData }) {
  const viewers = viewerLikes(data);
  const [chosen, setChosen] = useState<string>(() => viewers[0]?.id ?? NEW_VIEWER);
  const viewer = viewers.find((f) => f.id === chosen);
  const titles = photoTitles(data);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ViewerList viewers={viewers} chosen={viewer?.id} onChoose={setChosen} />
        <ViewerImporter
          key={viewer?.id ?? NEW_VIEWER}
          viewer={viewer}
          viewers={viewers}
          titles={titles}
          onSaved={setChosen}
        />
      </div>
      <MostLiked viewers={viewers} titles={titles} />
    </div>
  );
}

interface ViewerListProps {
  viewers: ViewerLikes[];
  chosen?: string;
  onChoose: (id: string) => void;
}

function ViewerList({ viewers, chosen, onChoose }: ViewerListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Everyone who sent their likes, with how many photos they liked.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {viewers.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {viewers.map((viewer) => (
          <button
            key={viewer.id}
            type="button"
            onClick={() => onChoose(viewer.id)}
            aria-current={viewer.id === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              viewer.id === chosen && "bg-muted font-medium",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{viewer.name}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {importedText(viewer.importedAt)}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">{viewer.photos.length}</span>
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 self-start"
          disabled={chosen === undefined}
          onClick={() => onChoose(NEW_VIEWER)}
        >
          <PlusIcon aria-hidden />
          New person
        </Button>
      </CardContent>
    </Card>
  );
}
