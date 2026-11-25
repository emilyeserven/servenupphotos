import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  type CameraOverride,
  cameraOverrides,
  type LensOverride,
  lensOverrides,
} from "@/api/cameras";
import type { CombinedData } from "@/api/photos";
import {
  CameraOverrideEditor,
  LensOverrideEditor,
} from "@/components/camera-overrides/override-editors";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type OverrideSubject,
  type SubjectRow,
  subjectPhotos,
  subjectRows,
} from "@/lib/camera-overrides";
import type { CombinedPhoto } from "@/lib/group-photos";
import { shownPhotos } from "@/lib/place-seeds";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** The Camera Overrides page: what to write instead of each camera's and each lens's EXIF values. */
export function CameraOverridesPage() {
  return (
    <Page
      wide
      title="Camera Overrides"
      description="What to write instead of a camera's or a lens's EXIF values, such as “Fujifilm X-T5” for “X-T5”, or a lens's name for “XF23mmF1.4 R”. Each camera's rules are one JSON file, combined into CAMERAS.json, and each lens's are one combined into LENSOVERRIDES.json. New photos get them when their EXIF is read; Update Data and the Photo page apply them to photos already saved."
    >
      <GitHubGate>{() => <Overrides />}</GitHubGate>
    </Page>
  );
}

function Overrides() {
  const combined = useCombinedData();
  return (
    <QueryResult query={combined} pendingLabel="Reading the photos and camera and lens overrides…">
      {(data) => <OverrideTabs data={data} />}
    </QueryResult>
  );
}

/** The tab in the address (`?tab=lenses`), or else Cameras. */
function useTab() {
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const tab: OverrideSubject = search.tab === "lenses" ? "lens" : "camera";
  const choose = (next: string) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        tab: next === "lens" ? "lenses" : undefined,
      }),
      resetScroll: false,
    });
  return { tab, choose };
}

/** The Cameras and Lenses tabs, each with how many overrides it has. */
function OverrideTabs({ data }: { data: CombinedData }) {
  const { tab, choose } = useTab();
  const photos = shownPhotos(data);
  const cameras = subjectRows(photos, "camera", cameraOverrides(data), (o) => o.camera);
  const lenses = subjectRows(photos, "lens", lensOverrides(data), (o) => o.lens);
  return (
    <Tabs value={tab} onValueChange={choose}>
      <TabsList>
        <TabsTrigger value="camera">Cameras ({overrideCount(cameras)})</TabsTrigger>
        <TabsTrigger value="lens">Lenses ({overrideCount(lenses)})</TabsTrigger>
      </TabsList>
      <TabsContent value="camera">
        <Chooser subject="camera" rows={cameras} photos={photos} />
      </TabsContent>
      <TabsContent value="lens">
        <Chooser subject="lens" rows={lenses} photos={photos} />
      </TabsContent>
    </Tabs>
  );
}

/** A camera's or lens's row, with its override if it has one. */
type AnyRow = SubjectRow<CameraOverride | LensOverride>;

/** How many of the rows have an override. */
function overrideCount(rows: AnyRow[]): number {
  return rows.filter((row) => row.override).length;
}

/** The list's title, and what an empty tab says, by what the tab is for. */
const LIST_TEXT: Record<OverrideSubject, { title: string; empty: string }> = {
  camera: { title: "Cameras", empty: "No photo has a camera in its EXIF yet." },
  lens: { title: "Lenses", empty: "No photo has a lens in its EXIF yet." },
};

interface ChooserProps {
  subject: OverrideSubject;
  rows: AnyRow[];
  photos: CombinedPhoto[];
}

/** The cameras (or lenses) listed on the left, and the chosen one's override edited on the right. */
function Chooser({ subject, rows, photos }: ChooserProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const row = rows.find((r) => r.name === chosen) ?? rows[0];
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
      <SubjectList subject={subject} rows={rows} chosen={row?.name} onChoose={setChosen} />
      <ChosenEditor subject={subject} row={row} photos={photos} />
    </div>
  );
}

/** What the chosen row's editor is keyed by, so each starts from its saved rules. */
function rowKey(row: AnyRow): string {
  return `${row.name}\u0000${row.override?.id ?? ""}`;
}

interface ChosenEditorProps {
  subject: OverrideSubject;
  /** The chosen camera or lens; undefined when the photos name none. */
  row?: AnyRow;
  /** Every photo, of which the editor gets the ones taken with the camera or lens. */
  photos: CombinedPhoto[];
}

/** The chosen camera's or lens's editor, or a note when there's none to choose. */
function ChosenEditor({ subject, row, photos }: ChosenEditorProps) {
  if (!row) return <EmptyNote>{LIST_TEXT[subject].empty}</EmptyNote>;
  const props = { name: row.name, photos: subjectPhotos(photos, subject, row.name) };
  if (subject === "lens") {
    const override = row.override as LensOverride | undefined;
    return <LensOverrideEditor key={rowKey(row)} {...props} override={override} />;
  }
  const override = row.override as CameraOverride | undefined;
  return <CameraOverrideEditor key={rowKey(row)} {...props} override={override} />;
}

interface SubjectListProps {
  subject: OverrideSubject;
  rows: AnyRow[];
  chosen?: string;
  onChoose: (name: string) => void;
}

function SubjectList({ subject, rows, chosen, onChoose }: SubjectListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{LIST_TEXT[subject].title}</CardTitle>
        <CardDescription>As the photos&apos; EXIF names them.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {rows.map((row) => (
          <button
            key={row.name}
            type="button"
            onClick={() => onChoose(row.name)}
            aria-current={row.name === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              row.name === chosen && "bg-muted font-medium",
            )}
          >
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {count(row.photos, "photo")}
              {row.override && (
                <span className="text-foreground">
                  , {count(row.override.rules.length, "rule")}
                </span>
              )}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
