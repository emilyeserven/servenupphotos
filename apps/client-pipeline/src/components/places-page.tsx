import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  type Localization,
  localizationId,
  type PlacesResponse,
  placesQuery,
  readEntries,
} from "@/api/places";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { PlaceEditor } from "@/components/place-editor";
import { QueryResult } from "@/components/query-result";
import { RegionEditor } from "@/components/region-editor";
import { RegionList, type RegionListData } from "@/components/region-list";
import { cityRows, countryRows } from "@/lib/place-cities";
import { unmappedPlacePhotos } from "@/lib/place-gps";
import { placePhotoCounts, shownPhotos } from "@/lib/place-seeds";
import { type RegionNode, regionNodes } from "@/lib/region-tree";
import { useCombinedData } from "@/stores/combined-data";

/** The Places page: every country, city and place as one list, and a panel beside it to edit one. */
export function PlacesPage() {
  return (
    <Page
      wide
      title="Places"
      description="Where photos were taken: countries, the cities in them, and places more exact than a city, such as Gyeongbokgung Palace. Each place is its own JSON file, combined into PLACES.json, and photos list them by ID with how they relate to them."
    >
      <GitHubGate>{(folder) => <PlacesLayout folder={folder} />}</GitHubGate>
    </Page>
  );
}

function PlacesLayout({ folder }: { folder: string }) {
  const read = useQuery(placesQuery);
  return (
    <QueryResult query={read} pendingLabel="Reading places from GitHub…">
      {(data) => <PlacesPanes folder={folder} data={data} />}
    </QueryResult>
  );
}

/** The localization ID of a country, city or place node. */
function nodeLocalizationId(node: RegionNode): string {
  return localizationId(node.kind, node.name, node.place?.id);
}

/** Everything the list and the edit panel show, from the place files and the photos. */
function useRegionList(data: PlacesResponse): RegionListData {
  const photos = shownPhotos(useCombinedData().data);
  const places = readEntries(data.places);
  const nodes = regionNodes({
    countries: countryRows(photos, places),
    cities: cityRows(photos, places),
    places,
    placePhotos: placePhotoCounts(photos),
  });
  const byId = new Map(readEntries(data.localizations).map((l) => [l.id, l]));
  const localizations = new Map<string, Localization>();
  for (const node of nodes) {
    const saved = byId.get(nodeLocalizationId(node));
    if (saved) localizations.set(node.key, saved);
  }
  return { data, places, nodes, localizations, unmapped: unmappedPlacePhotos(photos, places) };
}

/** The list on the left and the edit panel on the right; on a phone the panel comes first. */
function PlacesPanes({ folder, data }: { folder: string; data: PlacesResponse }) {
  const list = useRegionList(data);
  const panel = useRef<HTMLDivElement>(null);
  // The key of the row being edited, or "" for a new place. Bumped starts the panel afresh.
  const [editing, setEditing] = useState({ key: "", count: 0 });
  const edit = (key: string) => {
    setEditing((e) => ({ key, count: e.count + 1 }));
    panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const node = list.nodes.find((n) => n.key === editing.key);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div ref={panel} className="scroll-mt-6 lg:sticky lg:top-6 lg:order-last">
        <EditPanel
          key={`${editing.key}-${editing.count}`}
          folder={folder}
          list={list}
          node={node}
          onDone={() => edit("")}
        />
      </div>
      <RegionList
        list={list}
        selected={node?.key ?? ""}
        onSelect={(n) => edit(n.key)}
        onNew={() => edit("")}
      />
    </div>
  );
}

interface EditPanelProps {
  folder: string;
  list: RegionListData;
  /** The row being edited, or undefined for a new place. */
  node: RegionNode | undefined;
  onDone: () => void;
}

/** A place's form, a city's or country's localization, or a form for a new place. */
function EditPanel({ folder, list, node, onDone }: EditPanelProps) {
  if (!node)
    return <PlaceEditor folder={folder} place={null} places={list.places} onDone={onDone} />;
  const saved = list.localizations.get(node.key);
  if (!node.place) return <RegionEditor node={node} saved={saved} />;
  return (
    <PlaceEditor
      folder={folder}
      place={node.place}
      places={list.places}
      localization={saved}
      onDone={onDone}
    />
  );
}
