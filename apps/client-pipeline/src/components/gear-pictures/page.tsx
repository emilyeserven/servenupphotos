import { useState } from "react";
import type { GearKind } from "@portfolio/lib/gear-pictures";
import { gearFiles, type GearRow, gearRows } from "@/api/gear";
import type { CombinedData } from "@/api/photos";
import { GearCropCard } from "@/components/gear-pictures/crop-card";
import { GearEditor } from "@/components/gear-pictures/editor";
import { GearList } from "@/components/gear-pictures/gear-list";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** The Gear Pictures page: a picture and a few words for each camera and lens. */
export function GearPicturesPage() {
  return (
    <Page
      wide
      title="Gear Pictures"
      description="A picture and a few words for each camera and lens, shown in the portfolio's Gear & settings filter in place of its drawing of that kind of camera or lens. Pictures go to R2 as uploaded as soon as they're chosen, and the portfolio shows only each one's sized version, all exactly 267 × 200, lined up with the others in the sizing card under them; each camera's or lens's file is one JSON file, combined into GEAR.json."
    >
      <GitHubGate>{() => <Gear />}</GitHubGate>
    </Page>
  );
}

function Gear() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and gear pictures…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <GearChooser data={combined.data} />;
}

/** The chosen camera or lens: its kind and name. */
interface Chosen {
  kind: GearKind;
  name: string;
}

/** The cameras and lenses listed on the left, and the chosen one's picture edited on the right. */
function GearChooser({ data }: { data: CombinedData }) {
  const [kind, setKind] = useState<GearKind>("camera");
  const [chosen, setChosen] = useState<Chosen | undefined>();
  const rows = gearRows(shownPhotos(data), gearFiles(data), kind);
  const row = chosenRow(rows, chosen) ?? rows[0];
  const files = gearFiles(data);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <GearList
          kind={kind}
          onKind={setKind}
          rows={rows}
          chosen={row?.name}
          onChoose={(name) => setChosen({ kind, name })}
        />
        <ChosenGear row={row} />
      </div>
      <GearCropCard kind={kind} files={files.filter((file) => file.kind === kind)} />
    </div>
  );
}

/** The chosen camera's or lens's row, when it's among the rows. */
function chosenRow(rows: GearRow[], chosen?: Chosen): GearRow | undefined {
  return rows.find((row) => row.kind === chosen?.kind && row.name === chosen.name);
}

/** The editor for the chosen camera or lens, keyed by it so each starts from its saved file. */
function ChosenGear({ row }: { row?: GearRow }) {
  if (!row) return <p className="text-muted-foreground text-sm">No photo names one yet.</p>;
  return <GearEditor key={`${row.kind}\u0000${row.name}\u0000${row.file?.id ?? ""}`} row={row} />;
}
