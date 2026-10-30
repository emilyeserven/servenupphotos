import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { applyBulkPlacesMutation } from "@/api/bulk-places";
import { type Place, placesQuery } from "@/api/places";
import {
  SaveReviewed,
  UnknownPhotos,
  useReviewedSave,
} from "@/components/bulk-tagging/review-parts";
import { count } from "@/components/update-data-shared";
import {
  type BulkPlacePlan,
  type BulkPlacesReview,
  bulkPlacesToSave,
  mapLinks,
  placeLabel,
  tickedAtFirst,
  whereText,
} from "@/lib/bulk-places";
import { promptImageUrl } from "@/lib/tag-prompt";
import { tileImageUrl } from "@/lib/offline-thumbnails";

/** The paths of the photos that start ticked: those with a place the LLM isn't unsure of. */
function firstTicked(review: BulkPlacesReview): Set<string> {
  return new Set(review.plans.filter(tickedAtFirst).map((plan) => plan.photo.path));
}

/** paths with path added, or taken out when it's there. */
function toggled(paths: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(paths);
  if (!next.delete(path)) next.add(path);
  return next;
}

/**
 * The review of the LLM's answer: the new places to make, then each photo with the place it gets,
 * where that is, and links to check it on a map, ticked unless the LLM is unsure; then a button that
 * saves the ticked ones.
 */
export function BulkPlaceReview({ review }: { review: BulkPlacesReview }) {
  const [ticked, setTicked] = useState(() => firstTicked(review));
  const apply = useReviewedSave(applyBulkPlacesMutation, placesQuery.queryKey);
  const busy = apply.isPending || apply.isSuccess;
  const save = bulkPlacesToSave(review, ticked);
  const fresh = new Set(review.newPlaces.map((place) => place.id));
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownPhotos names={review.unknown} noun="places" />
      {/* Once saved, the new places are made, so only what was saved is left to say. */}
      {!apply.isSuccess && <NewPlaceList places={save.newPlaces} names={review.names} />}
      <ul className="flex flex-col gap-3">
        {review.plans.map((plan) => (
          <PhotoPlaceRow
            key={plan.photo.path}
            plan={plan}
            names={review.names}
            isNew={fresh.has(plan.place?.id ?? "")}
            ticked={ticked.has(plan.photo.path)}
            disabled={busy}
            onToggle={() => setTicked((paths) => toggled(paths, plan.photo.path))}
          />
        ))}
      </ul>
      <SaveReviewed
        apply={apply}
        save={save}
        noun="places"
        busy={busy}
        done={(data) =>
          `Made ${count(data.newPlaces, "new place")} and gave places to ${count(data.photos, "photo")}`
        }
      />
    </div>
  );
}

/** The new places the ticked photos use, which saving makes first. */
function NewPlaceList({ places, names }: { places: Place[]; names: Record<string, string> }) {
  if (places.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>New places, made with the answer&apos;s city, country and GPS position:</p>
      <ul className="flex flex-col gap-1 pl-1">
        {places.map((place) => (
          <li key={place.id}>
            {place.name}
            <span className="text-muted-foreground">
              {place.parent && ` in ${names[place.parent]}`} · {whereText(place)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PhotoPlaceRowProps {
  plan: BulkPlacePlan;
  /** Every place's name, by ID. */
  names: Record<string, string>;
  /** Whether the place is one saving makes. */
  isNew: boolean;
  ticked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/** The photo's title, or "" when it's a draft without one. */
function title(data: Record<string, unknown>): string {
  return typeof data.title === "string" ? data.title : "";
}

/** One photo with the place the answer gives it, and a checkbox to give it that place. */
function PhotoPlaceRow(props: PhotoPlaceRowProps) {
  const { photo, place } = props.plan;
  const image =
    tileImageUrl(photo.data) ??
    promptImageUrl(photo.data.images as Record<string, unknown> | undefined, "");
  return (
    <li className="flex gap-3 rounded-md border p-3">
      <img src={image} alt="" className="bg-muted size-16 shrink-0 rounded object-cover" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate">
          <code>{photo.name}</code>
          {title(photo.data) && (
            <span className="text-muted-foreground"> · {title(photo.data)}</span>
          )}
        </p>
        {place ? <PlaceDetails {...props} place={place} /> : <NoPlace plan={props.plan} />}
      </div>
    </li>
  );
}

/** Why the photo gets no place. */
function NoPlace({ plan }: { plan: BulkPlacePlan }) {
  return (
    <p className="text-muted-foreground">
      {plan.pasted ? "The answer gives it no place." : "The answer leaves it out."}
    </p>
  );
}

/** The place's checkbox, where it is, why the LLM thinks so, and links to check it. */
function PlaceDetails(props: PhotoPlaceRowProps & { place: Place }) {
  const { plan, place } = props;
  return (
    <>
      <PlaceCheckbox {...props} />
      <p className="text-muted-foreground">{whereText(place)}</p>
      <WrittenIn plan={plan} />
      <Reasoning plan={plan} />
      <MapLinks plan={plan} place={place} />
    </>
  );
}

/** The checkbox that gives the photo the place, such as "at Gwangjang Market (new place)". */
function PlaceCheckbox({ plan, names, isNew, ticked, disabled, onToggle }: PhotoPlaceRowProps) {
  return (
    <label className="flex items-start gap-1.5">
      <input
        type="checkbox"
        className="mt-1"
        checked={ticked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span>
        {placeLabel(plan, names)}
        <span className="text-muted-foreground text-xs">
          {" "}
          ({isNew ? "new place" : "a place already"})
        </span>
      </span>
    </label>
  );
}

/** How sure the LLM is, and why it thinks so. */
function Reasoning({ plan }: { plan: BulkPlacePlan }) {
  const { confidence = "", reasoning = "" } = plan.pasted ?? {};
  return (
    <p className="text-muted-foreground">
      <span className="text-foreground">{confidence || "Unknown"} confidence</span>
      {reasoning && `: ${reasoning}`}
    </p>
  );
}

/** The city and country saving writes into the photo, when it shows none. */
function WrittenIn({ plan }: { plan: BulkPlacePlan }) {
  const texts = [
    plan.customCity && `city ${plan.customCity}`,
    plan.customCountry && `country ${plan.customCountry}`,
  ].filter(Boolean);
  if (texts.length === 0) return null;
  return <p className="text-muted-foreground">Also writes in its {texts.join(" and ")}.</p>;
}

/** Links to check the place: the answer's own map link, a map search, and its GPS position. */
function MapLinks({ plan, place }: { plan: BulkPlacePlan; place: Place }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1">
      {mapLinks(plan, place).map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-4"
        >
          {link.label}
          <ExternalLinkIcon className="size-3" />
        </a>
      ))}
    </p>
  );
}
