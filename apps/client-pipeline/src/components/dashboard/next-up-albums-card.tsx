import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { TopList } from "@/components/lightroom-albums/next-up";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LightroomAlbum, type LightroomStage, allAlbums } from "@/lib/lightroom-albums";
import {
  type LightroomConnection,
  NEXT_UP_STAGES,
  topAtStage,
  topOverall,
} from "@/lib/lightroom-next-up";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** Which Next up list the card shows: "overall", or a stage's name, or "none" for no stage. */
type Pick = "overall" | "none" | LightroomStage;

/** The pick's list of up to 3 albums. */
function pickedAlbums(albums: LightroomAlbum[], pick: Pick, online: LightroomConnection) {
  if (pick === "overall") return topOverall(albums, online);
  return topAtStage(albums, online, pick === "none" ? null : pick);
}

/** The pick's name above its list. */
function pickTitle(pick: Pick): string {
  if (pick === "overall") return "Overview";
  return pick === "none" ? "No stage" : pick;
}

/**
 * The Lightroom Albums page's Next up suggestions on the Dashboard: Overview by default, or the 3
 * albums at one stage, with the page's Online or Offline choice.
 */
export function NextUpAlbumsCard() {
  const file = useLightroomAlbumsStore((state) => state.file);
  const connection = useLightroomAlbumsStore((state) => state.connection);
  const [pick, setPick] = useState<Pick>("overall");
  const albums = file ? allAlbums(file.items) : [];
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>
            <Link to="/lightroom-albums" className="hover:underline">
              Next up albums
            </Link>
          </CardTitle>
          <CardDescription>
            From Lightroom Albums{connection === "offline" && ", only the ones kept offline"}.
          </CardDescription>
        </div>
        <StagePicker value={pick} onChange={setPick} />
      </CardHeader>
      <CardContent>
        {file ? (
          <TopList
            title={pickTitle(pick)}
            albums={pickedAlbums(albums, pick, connection)}
            offline={connection === "offline"}
            showStage={pick === "overall"}
          />
        ) : (
          <NoList />
        )}
      </CardContent>
    </Card>
  );
}

/** Picks Overview or one stage's list. */
function StagePicker({ value, onChange }: { value: Pick; onChange: (pick: Pick) => void }) {
  return (
    <select
      aria-label="Next up list"
      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as Pick)}
    >
      <option value="overall">Overview</option>
      {NEXT_UP_STAGES.map((stage) => (
        <option key={stage ?? "none"} value={stage ?? "none"}>
          {stage ?? "No stage"}
        </option>
      ))}
    </select>
  );
}

function NoList() {
  return (
    <p className="text-muted-foreground text-sm">
      No albums yet.{" "}
      <Link to="/lightroom-albums/import" className="text-foreground underline underline-offset-4">
        Import your Lightroom albums
      </Link>{" "}
      to get suggestions.
    </p>
  );
}
