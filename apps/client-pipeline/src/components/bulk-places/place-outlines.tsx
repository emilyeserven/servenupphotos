import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { areasQuery } from "@/api/areas";
import { placeAreaQuery, savePlaceAreaMutation } from "@/api/place-areas";
import type { Place } from "@/api/places";

/** A new place to fetch the outline of, by the Wikidata item ID the answer gave it. */
export interface OutlineAsk {
  place: Place;
  wikidata: string;
}

/** How fetching one place's outline went: still to come, saved, none found, or what went wrong. */
type OutlineState = "waiting" | "saved" | "none" | { error: string };

/** The new places the answer gave a Wikidata ID, from the places saving made. */
export function outlineAsks(places: Place[], wikidata: Record<string, string>): OutlineAsk[] {
  return places.flatMap((place) => {
    const id = wikidata[place.id];
    return id ? [{ place, wikidata: id }] : [];
  });
}

/** What went wrong, as a sentence's end. */
function failure(error: unknown): OutlineState {
  return { error: error instanceof Error ? error.message : String(error) };
}

/**
 * Fetches each place's outline in turn, once: its Wikidata item's OpenStreetMap relation, through
 * the area search (`GET /api/areas?q=Q…`, two requests), and saves the first one found as the
 * place's area, a change waiting for Commit. The backend spaces the requests a second apart.
 */
function useOutlines(asks: OutlineAsk[]): Record<string, OutlineState> {
  const queryClient = useQueryClient();
  const save = useMutation(savePlaceAreaMutation);
  const [states, setStates] = useState<Record<string, OutlineState>>({});
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const set = (id: string, state: OutlineState) => setStates((s) => ({ ...s, [id]: state }));
    const fetchOne = async ({ place, wikidata }: OutlineAsk) => {
      const [area] = await queryClient.fetchQuery(areasQuery(wikidata));
      if (!area) return set(place.id, "none");
      await save.mutateAsync({ id: place.id, area: { osm: area.osm, shape: area.shape } });
      void queryClient.invalidateQueries(placeAreaQuery(place.id));
      set(place.id, "saved");
    };
    void (async () => {
      for (const ask of asks)
        await fetchOne(ask).catch((e: unknown) => set(ask.place.id, failure(e)));
    })();
  }, [asks, queryClient, save]);
  return states;
}

const LABELS: Record<"waiting" | "saved" | "none", string> = {
  waiting: "Fetching…",
  saved: "Outline saved as its area",
  none: "No outline on OpenStreetMap; the map circles it instead",
};

/** How one place's fetch went, in words. */
function stateText(state: OutlineState | undefined): string {
  const s = state ?? "waiting";
  return typeof s === "string" ? LABELS[s] : `Couldn't fetch it: ${s.error}`;
}

/**
 * Once the new places are made, their real outlines from OpenStreetMap, fetched by the Wikidata ID
 * the answer gave each, with how each went.
 */
export function PlaceOutlines({ asks }: { asks: OutlineAsk[] }) {
  const states = useOutlines(asks);
  if (asks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>Outlines from OpenStreetMap, by each new place&apos;s Wikidata ID:</p>
      <ul className="flex flex-col gap-1 pl-1">
        {asks.map(({ place, wikidata }) => (
          <li key={place.id}>
            {place.name}{" "}
            <a
              className="text-muted-foreground underline underline-offset-4"
              href={`https://www.wikidata.org/wiki/${wikidata}`}
              target="_blank"
              rel="noreferrer"
            >
              {wikidata}
            </a>
            <span className="text-muted-foreground"> · {stateText(states[place.id])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
