import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { type FanLikes, fanLikes, importedText } from "@/api/fan-likes";
import type { CombinedData } from "@/api/photos";
import { FanImporter } from "@/components/fan-likes/importer";
import { MostLiked, photoTitles } from "@/components/fan-likes/most-liked";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** The Fan Likes page: the lists of liked photos people sent from the portfolio's My Likes page. */
export function FanLikesPage() {
  return (
    <Page
      wide
      title="Fan Likes"
      description="The photos people liked on the portfolio, from the list My Likes' “Send to photographer” makes. Each person is one JSON file, combined into LIKES.json, and importing a person's list again replaces their old one, so nobody's likes count twice."
    >
      <GitHubGate>{() => <Likes />}</GitHubGate>
    </Page>
  );
}

function Likes() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and fan likes from GitHub…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <FanChooser data={combined.data} />;
}

/** The chosen person's ID, or "" for a new one. */
const NEW_FAN = "";

/** The people listed on the left and the chosen one, or a new one, imported on the right, with the totals under them. */
function FanChooser({ data }: { data: CombinedData }) {
  const fans = fanLikes(data);
  const [chosen, setChosen] = useState<string>(() => fans[0]?.id ?? NEW_FAN);
  const fan = fans.find((f) => f.id === chosen);
  const titles = photoTitles(data);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FanList fans={fans} chosen={fan?.id} onChoose={setChosen} />
        <FanImporter
          key={fan?.id ?? NEW_FAN}
          fan={fan}
          fans={fans}
          titles={titles}
          onSaved={setChosen}
        />
      </div>
      <MostLiked fans={fans} titles={titles} />
    </div>
  );
}

interface FanListProps {
  fans: FanLikes[];
  chosen?: string;
  onChoose: (id: string) => void;
}

function FanList({ fans, chosen, onChoose }: FanListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Everyone who sent their likes, with how many photos they liked.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {fans.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {fans.map((fan) => (
          <button
            key={fan.id}
            type="button"
            onClick={() => onChoose(fan.id)}
            aria-current={fan.id === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              fan.id === chosen && "bg-muted font-medium",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{fan.name}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {importedText(fan.importedAt)}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">{fan.photos.length}</span>
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 self-start"
          disabled={chosen === undefined}
          onClick={() => onChoose(NEW_FAN)}
        >
          <PlusIcon aria-hidden />
          New person
        </Button>
      </CardContent>
    </Card>
  );
}
