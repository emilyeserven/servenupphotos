import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CityRow, CountryRow } from "@/lib/place-cities";

/** Says there's nothing to list yet. */
function NoneYet({ what }: { what: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      No {what} yet. They come from photos' city and country, and from places'.
    </p>
  );
}

/** A count, or a muted dash for none. */
function Count({ value }: { value: number }) {
  return (
    <TableCell className="text-right tabular-nums">
      {value || <span className="text-muted-foreground">–</span>}
    </TableCell>
  );
}

interface CityTableProps {
  cities: CityRow[];
  /** Shows the places in the city on the Places tab. */
  onShowPlaces: (city: string) => void;
}

/**
 * Every city that photos show or places are in, with its country and how many places and photos have
 * it. A city only photos show is inferred: choosing it as a place's city adds it.
 */
export function CityTable({ cities, onShowPlaces }: CityTableProps) {
  if (cities.length === 0) return <NoneYet what="cities" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Country</TableHead>
          <TableHead className="text-right">Places</TableHead>
          <TableHead className="text-right">Photos</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cities.map((city) => (
          <TableRow key={city.name}>
            <TableCell>
              <div className="font-medium">{city.name}</div>
              {city.places === 0 && (
                <div className="text-muted-foreground text-xs">Inferred from photos</div>
              )}
            </TableCell>
            <TableCell>
              {city.country || <span className="text-muted-foreground">Unknown</span>}
            </TableCell>
            <Count value={city.places} />
            <Count value={city.photos} />
            <TableCell className="text-right">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={city.places === 0}
                onClick={() => onShowPlaces(city.name)}
              >
                Show places
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Every country that photos show or places or cities are in, with how many of each have it. */
export function CountryTable({ countries }: { countries: CountryRow[] }) {
  if (countries.length === 0) return <NoneYet what="countries" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Country</TableHead>
          <TableHead className="text-right">Cities</TableHead>
          <TableHead className="text-right">Places</TableHead>
          <TableHead className="text-right">Photos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {countries.map((country) => (
          <TableRow key={country.name}>
            <TableCell className="font-medium">{country.name}</TableCell>
            <Count value={country.cities} />
            <Count value={country.places} />
            <Count value={country.photos} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
