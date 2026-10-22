import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { type Place, type PlacesResponse, readEntries } from "@/api/places";
import { PlaceTable } from "@/components/place-table";
import { QueryResult } from "@/components/query-result";
import { CityTable, CountryTable } from "@/components/region-tables";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cityRows, countryRows } from "@/lib/place-cities";
import { shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

interface PlaceListCardProps {
  read: UseQueryResult<PlacesResponse>;
  onEdit: (place: Place) => void;
}

/** Every place, city and country, each on its own tab, like the Localizations page. */
export function PlaceListCard({ read, onEdit }: PlaceListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Places, cities and countries</CardTitle>
        <CardDescription>
          {read.data ? `Read on ${read.data.branch}.` : "Every place file on GitHub."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={read} pendingLabel="Reading places from GitHub…">
          {(data) => <PlaceTabs data={data} onEdit={onEdit} />}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

function PlaceTabs({ data, onEdit }: { data: PlacesResponse; onEdit: (place: Place) => void }) {
  const [tab, setTab] = useState("places");
  // The city the Places tab shows the places in; "" for every place.
  const [city, setCity] = useState("");
  const places = readEntries(data.places);
  const photos = shownPhotos(useCombinedData().data);
  const cities = cityRows(photos, places);
  const countries = countryRows(photos, places);
  const showPlaces = (name: string) => {
    setCity(name);
    setTab("places");
  };
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="places">Places ({places.length})</TabsTrigger>
        <TabsTrigger value="cities">Cities ({cities.length})</TabsTrigger>
        <TabsTrigger value="countries">Countries ({countries.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="places">
        <PlaceTable data={data} city={city} cities={cities} onCity={setCity} onEdit={onEdit} />
      </TabsContent>
      <TabsContent value="cities">
        <CityTable cities={cities} onShowPlaces={showPlaces} />
      </TabsContent>
      <TabsContent value="countries">
        <CountryTable countries={countries} />
      </TabsContent>
    </Tabs>
  );
}
